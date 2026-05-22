import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import connectDB from "@/lib/db";
import Job from "@/models/Job";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const decoded = verifyToken(token) as { id: string } | null;
    if (!decoded) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    if (id) {
      const job = await Job.findById(id);
      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
      if (job.userId.toString() !== decoded.id) {
        return NextResponse.json({ error: "Unauthorized access to job resource" }, { status: 403 });
      }
      return NextResponse.json({ job });
    }

    // Retrieve active/pending jobs for this user
    const jobs = await Job.find({ 
      userId: decoded.id, 
      status: { $in: ["pending", "running"] } 
    }).sort({ createdAt: -1 });

    return NextResponse.json({ jobs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to retrieve job status" }, { status: 500 });
  }
}
