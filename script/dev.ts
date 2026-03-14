import { spawn } from "child_process";
import fs from "fs";
import path from "path";

function getListeningInodesForPort(port: number) {
  const portHex = port.toString(16).toUpperCase().padStart(4, "0");
  const lines = fs.readFileSync("/proc/net/tcp", "utf8").trim().split("\n").slice(1);

  return lines
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts[1]?.endsWith(`:${portHex}`) && parts[3] === "0A")
    .map((parts) => parts[9]);
}

function findPidBySocketInode(inode: string) {
  for (const pid of fs.readdirSync("/proc").filter((value) => /^\d+$/.test(value))) {
    const fdDir = path.join("/proc", pid, "fd");
    try {
      for (const fd of fs.readdirSync(fdDir)) {
        const target = fs.readlinkSync(path.join(fdDir, fd));
        if (target === `socket:[${inode}]`) {
          return Number(pid);
        }
      }
    } catch {
      // Ignore transient process/proc errors.
    }
  }

  return null;
}

function getCommandLine(pid: number) {
  try {
    return fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replace(/\0/g, " ").trim();
  } catch {
    return "";
  }
}

function getParentPid(pid: number) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const fields = stat.split(" ");
    return Number(fields[3] || 0);
  } catch {
    return 0;
  }
}

function isPortListening(port: number) {
  return getListeningInodesForPort(port).length > 0;
}

async function waitForPortToClose(port: number, timeoutMs: number) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!isPortListening(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  console.error(`Timed out waiting for port ${port} to become free.`);
  process.exit(1);
}

async function killExistingLocalDevServer(port: number) {
  const inodes = getListeningInodesForPort(port);
  if (inodes.length === 0) return;

  for (const inode of inodes) {
    const pid = findPidBySocketInode(inode);
    if (!pid) continue;

    const cmd = getCommandLine(pid);
    const looksLikeLocalDev =
      cmd.includes("/home/runner/workspace") &&
      (cmd.includes("server/index.ts") || cmd.includes("tsx watch") || cmd.includes("npm run dev"));

    if (!looksLikeLocalDev) {
      console.error(`Port ${port} is already in use by PID ${pid}. Refusing to kill a non-local process.`);
      process.exit(1);
    }

    console.log(`Stopping existing local dev server on port ${port} (PID ${pid}).`);
    try {
      process.kill(pid, "SIGTERM");
      let currentPid = getParentPid(pid);
      let hops = 0;
      while (currentPid > 1 && hops < 4) {
        const parentCmd = getCommandLine(currentPid);
        const parentLooksLocal =
          parentCmd.includes("/home/runner/workspace") &&
          (parentCmd.includes("server/index.ts") || parentCmd.includes("tsx watch") || parentCmd.includes("npm run dev"));
        if (!parentLooksLocal) break;
        process.kill(currentPid, "SIGTERM");
        currentPid = getParentPid(currentPid);
        hops += 1;
      }
    } catch (error) {
      console.error(`Failed to stop PID ${pid}:`, error);
      process.exit(1);
    }
  }

  await waitForPortToClose(port, 5000);
}

function startWatcher() {
  const child = spawn("npx", ["tsx", "watch", "server/index.ts"], {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "development",
    },
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

await killExistingLocalDevServer(5000);
startWatcher();
