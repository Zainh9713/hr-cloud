import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  try {
    // 1. Authenticate session
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized access: Developer credentials required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");

    const memory = process.memoryUsage();
    const uptime = process.uptime();
    const cpu = process.cpuUsage();

    // 2. Return Prometheus text format if requested
    if (format === "prometheus") {
      const promText = [
        `# HELP hrcloud_upload_failures_total Total file upload failures`,
        `# TYPE hrcloud_upload_failures_total counter`,
        `hrcloud_upload_failures_total ${logger.metrics.uploadFailures}`,
        ``,
        `# HELP hrcloud_chunk_failures_total Total chunk upload failures`,
        `# TYPE hrcloud_chunk_failures_total counter`,
        `hrcloud_chunk_failures_total ${logger.metrics.chunkFailures}`,
        ``,
        `# HELP hrcloud_websocket_disconnects_total Total websocket disconnect failures`,
        `# TYPE hrcloud_websocket_disconnects_total counter`,
        `hrcloud_websocket_disconnects_total ${logger.metrics.websocketDisconnects}`,
        ``,
        `# HELP hrcloud_ai_failures_total Total AI query processing failures`,
        `# TYPE hrcloud_ai_failures_total counter`,
        `hrcloud_ai_failures_total ${logger.metrics.aiFailures}`,
        ``,
        `# HELP hrcloud_queue_failures_total Total background queue and job runner failures`,
        `# TYPE hrcloud_queue_failures_total counter`,
        `hrcloud_queue_failures_total ${logger.metrics.queueFailures}`,
        ``,
        `# HELP hrcloud_storage_failures_total Total storage provider I/O failures`,
        `# TYPE hrcloud_storage_failures_total counter`,
        `hrcloud_storage_failures_total ${logger.metrics.storageFailures}`,
        ``,
        `# HELP hrcloud_db_bottlenecks_total Total database queries exceeding performance budget`,
        `# TYPE hrcloud_db_bottlenecks_total counter`,
        `hrcloud_db_bottlenecks_total ${logger.metrics.dbBottlenecks}`,
        ``,
        `# HELP hrcloud_security_violations_total Total active security and rate limiting violations`,
        `# TYPE hrcloud_security_violations_total counter`,
        `hrcloud_security_violations_total ${logger.metrics.securityViolations}`,
        ``,
        `# HELP hrcloud_process_memory_rss_bytes Resident Set Size (RSS) allocated for the NextJS node process`,
        `# TYPE hrcloud_process_memory_rss_bytes gauge`,
        `hrcloud_process_memory_rss_bytes ${memory.rss}`,
        ``,
        `# HELP hrcloud_process_memory_heap_used_bytes Memory currently used by V8 heap objects`,
        `# TYPE hrcloud_process_memory_heap_used_bytes gauge`,
        `hrcloud_process_memory_heap_used_bytes ${memory.heapUsed}`,
        ``,
        `# HELP hrcloud_process_uptime_seconds Total runtime of server in seconds`,
        `# TYPE hrcloud_process_uptime_seconds gauge`,
        `hrcloud_process_uptime_seconds ${uptime}`
      ].join("\n");

      return new NextResponse(promText, {
        status: 200,
        headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
      });
    }

    // 3. Return JSON response
    return NextResponse.json({
      uptime: {
        seconds: uptime,
        formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
      },
      system: {
        memory: {
          rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          external: `${(memory.external / 1024 / 1024).toFixed(2)} MB`
        },
        cpu: {
          user: cpu.user,
          system: cpu.system
        }
      },
      telemetry: logger.metrics,
      observability: {
        sentry: { status: process.env.SENTRY_DSN ? "configured" : "unconfigured" },
        grafana: { status: "ready_via_prometheus_scraper" },
        logtail: { status: process.env.LOGTAIL_SOURCE_TOKEN ? "configured" : "unconfigured" }
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
