import mongoose from "mongoose";
import { logger } from "./logger";

export interface TransactionContext {
  session: mongoose.ClientSession | null;
  registerRollback: (rollbackFn: () => Promise<void> | void) => void;
}

/**
 * Runs a set of actions inside a MongoDB transaction with a fallback to application-level rollback
 * actions if Mongoose/MongoDB transactions are not supported (e.g. in standalone local development).
 */
export async function runInTransaction<T>(
  action: (context: TransactionContext) => Promise<T>
): Promise<T> {
  const rollbacks: (() => Promise<void> | void)[] = [];
  const registerRollback = (rollbackFn: () => Promise<void> | void) => {
    rollbacks.push(rollbackFn);
  };

  let session: mongoose.ClientSession | null = null;
  let useNativeTransaction = false;

  try {
    const db = mongoose.connection.db;
    const hello = db ? await db.command({ hello: 1 }) : null;
    const isReplicaSet = !!(hello && hello.setName);

    if (isReplicaSet) {
      session = await mongoose.startSession();
      session.startTransaction();
      useNativeTransaction = true;
    } else {
      logger.info(
        "MongoDB is running in standalone mode (no replica set detected). Bypassing native transactions and relying on application-level rollback coordination."
      );
      session = null;
    }
  } catch (err: any) {
    logger.warn(
      `Failed to determine replica set status or start native MongoDB Transaction. Falling back to application-level rollback: ${err.message}`
    );
    session = null;
  }

  try {
    const result = await action({ session, registerRollback });

    if (useNativeTransaction && session) {
      await session.commitTransaction();
    }

    return result;
  } catch (error) {
    logger.error("Transaction execution failed. Initiating cleanup and rollback protocols.", error);

    if (useNativeTransaction && session) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        logger.error("Failed to abort native MongoDB transaction:", abortErr);
      }
    }

    // Execute application-level rollbacks in reverse order
    for (let i = rollbacks.length - 1; i >= 0; i--) {
      try {
        logger.info(`Executing application-level rollback handler ${i + 1}/${rollbacks.length}...`);
        await rollbacks[i]();
      } catch (rollbackErr) {
        logger.error(`Error executing application-level rollback action:`, rollbackErr);
      }
    }

    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
}
