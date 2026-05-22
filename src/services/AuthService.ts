import connectDB from "@/lib/db";
import User, { IUser } from "@/models/User";
import bcrypt from "bcryptjs";
import { signToken, verifyToken } from "@/lib/jwt";
import StorageStats from "@/models/StorageStats";

export class AuthService {
  public static async getUserIdFromToken(token?: string): Promise<string | null> {
    if (!token) return null;
    try {
      const decoded = verifyToken(token) as { id: string } | null;
      return decoded?.id || null;
    } catch {
      return null;
    }
  }

  public static async getAuthUser(token?: string): Promise<IUser | null> {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) return null;
    await connectDB();
    return User.findById(userId).select("-password");
  }

  public static async login(email: string, password: string): Promise<{ token: string; user: any }> {
    await connectDB();
    if (!email || !password) {
      throw new Error("Missing fields");
    }
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("Invalid credentials");
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error("Invalid credentials");
    }
    const token = signToken({ id: user._id, email: user.email });
    return {
      token,
      user: { id: user._id, name: user.name, email: user.email }
    };
  }

  public static async register(name: string, email: string, password: string): Promise<{ token: string; user: any }> {
    await connectDB();
    if (!name || !email || !password) {
      throw new Error("Missing fields");
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error("User already exists");
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = await User.create({
      name,
      email,
      password: hashedPassword
    });
    // Create default StorageStats
    await StorageStats.create({
      userId: user._id,
      totalLimit: 5 * 1024 * 1024 * 1024,
      usedStorage: 0
    });
    const token = signToken({ id: user._id, email: user.email });
    return {
      token,
      user: { id: user._id, name: user.name, email: user.email }
    };
  }

  public static async updatePassword(userId: string, newPasswordStr: string): Promise<void> {
    await connectDB();
    if (!newPasswordStr || newPasswordStr.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPasswordStr, salt);
    const updated = await User.findByIdAndUpdate(userId, { password: hashedPassword });
    if (!updated) {
      throw new Error("User not found");
    }
  }
}
