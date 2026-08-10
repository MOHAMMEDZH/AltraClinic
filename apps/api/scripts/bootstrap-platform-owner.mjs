#!/usr/bin/env node
/**
 * One-time Platform Owner bootstrap.
 *
 * Interactive:
 *   npm run bootstrap:platform-owner -- --email owner@example.com
 *
 * Non-interactive (stdin password, then newline, then confirmation):
 *   npm run bootstrap:platform-owner -- --email owner@example.com --password-stdin
 *
 * Test-only (NODE_ENV=test only):
 *   PLATFORM_BOOTSTRAP_PASSWORD_TEST_ONLY=... (never for ops)
 *
 * Passwords are never accepted as CLI args or ordinary env vars outside tests.
 */
import { createInterface } from 'readline';
import { stdin as input, stdout as output, stderr } from 'process';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const MAX_PASSWORD_BYTES = 1024;
const MIN_PASSWORD_LENGTH = 12;

function printHelp() {
  console.log(`Usage:
  npm run bootstrap:platform-owner -- --email <email>
  npm run bootstrap:platform-owner -- --email <email> --password-stdin

Options:
  --email <addr>       Platform Owner email (required unless prompted)
  --password-stdin     Read password then confirmation from stdin (no echo expected from caller)
  --help               Show this help

Security:
  Passwords are never accepted as command-line arguments.
  Ordinary PLATFORM_BOOTSTRAP_PASSWORD is rejected outside NODE_ENV=test.
  Do not put passwords in package scripts or .env files for operations.
`);
}

function parseArgs(argv) {
  const out = { email: null, passwordStdin: false, help: false, rejectedPasswordFlag: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--email') out.email = argv[++i] ?? null;
    else if (arg === '--password-stdin') out.passwordStdin = true;
    else if (arg === '--password' || arg.startsWith('--password=')) out.rejectedPasswordFlag = true;
    else if (arg === '--email=' || arg.startsWith('--email=')) out.email = arg.slice('--email='.length);
  }
  return out;
}

function assertPasswordPolicy(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required.');
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new Error('Password exceeds maximum allowed size.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

async function readHidden(promptText) {
  if (!input.isTTY || !output.isTTY) {
    throw new Error('Interactive password entry requires a TTY. Use --password-stdin for non-interactive input.');
  }
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input, output, terminal: true });
    const stdin = input;
    output.write(promptText);
    const wasRaw = stdin.isRaw;
    try {
      stdin.setRawMode?.(true);
    } catch {
      rl.close();
      reject(new Error('Unable to disable echo for password entry.'));
      return;
    }
    let password = '';
    const onData = (chunk) => {
      const chars = chunk.toString('utf8');
      for (const c of chars) {
        if (c === '\n' || c === '\r' || c === '\u0004') {
          stdin.setRawMode?.(wasRaw ?? false);
          stdin.removeListener('data', onData);
          rl.close();
          output.write('\n');
          resolve(password);
          return;
        }
        if (c === '\u0003') {
          stdin.setRawMode?.(wasRaw ?? false);
          stdin.removeListener('data', onData);
          rl.close();
          reject(new Error('Bootstrap cancelled.'));
          return;
        }
        if (c === '\u007f' || c === '\b') {
          password = password.slice(0, -1);
          continue;
        }
        if (c < ' ' && c !== '\t') continue;
        password += c;
        if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
          stdin.setRawMode?.(wasRaw ?? false);
          stdin.removeListener('data', onData);
          rl.close();
          reject(new Error('Password exceeds maximum allowed size.'));
        }
      }
    };
    stdin.on('data', onData);
  });
}

async function readLine(promptText) {
  const rl = createInterface({ input, output, terminal: Boolean(output.isTTY) });
  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function readStdinPasswordPair() {
  const chunks = [];
  let total = 0;
  for await (const chunk of input) {
    total += chunk.length;
    if (total > MAX_PASSWORD_BYTES * 4) {
      throw new Error('Password input exceeds maximum allowed size.');
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  const lines = text.split(/\r?\n/);
  const password = lines[0] ?? '';
  const confirm = lines[1] ?? '';
  return { password, confirm };
}

async function resolvePassword(opts) {
  const isTest = process.env.NODE_ENV === 'test';
  if (process.env.PLATFORM_BOOTSTRAP_PASSWORD) {
    if (!isTest) {
      throw new Error(
        'PLATFORM_BOOTSTRAP_PASSWORD is not accepted outside NODE_ENV=test. Use interactive prompt or --password-stdin.',
      );
    }
  }
  if (isTest && process.env.PLATFORM_BOOTSTRAP_PASSWORD_TEST_ONLY) {
    const password = process.env.PLATFORM_BOOTSTRAP_PASSWORD_TEST_ONLY;
    assertPasswordPolicy(password);
    return password;
  }
  if (opts.passwordStdin) {
    const { password, confirm } = await readStdinPasswordPair();
    assertPasswordPolicy(password);
    if (password !== confirm) throw new Error('Password confirmation does not match.');
    return password;
  }
  const password = await readHidden('Platform Owner password: ');
  const confirm = await readHidden('Confirm password: ');
  assertPasswordPolicy(password);
  if (password !== confirm) throw new Error('Password confirmation does not match.');
  return password;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }
  if (opts.rejectedPasswordFlag) {
    throw new Error('Password must not be supplied as a command-line argument.');
  }

  let email = opts.email?.trim().toLowerCase() ?? null;
  if (!email) {
    if (process.env.PLATFORM_BOOTSTRAP_EMAIL) {
      email = process.env.PLATFORM_BOOTSTRAP_EMAIL.trim().toLowerCase();
    } else if (input.isTTY) {
      email = String(await readLine('Platform Owner email: ')).trim().toLowerCase();
    }
  }
  if (!email || !email.includes('@')) {
    throw new Error('A valid --email is required.');
  }

  const password = await resolvePassword(opts);
  const passwordHash = await bcrypt.hash(password, 12);

  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Serialize concurrent bootstrap attempts across connections.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(470008001)`;
        const existing = await tx.platformUser.count();
        if (existing > 0) throw new Error('Platform users already exist; bootstrap refused.');
        const user = await tx.platformUser.create({
          data: {
            email,
            passwordHash,
            status: 'active',
            isActive: true,
            mfaEnabled: false,
          },
        });
        await tx.platformUserRole.create({
          data: { platformUserId: user.id, roleKey: 'platform_owner' },
        });
        return user;
      },
      { timeout: 30_000 },
    );

    console.log(
      JSON.stringify({
        ok: true,
        platformUserId: result.id,
        email: result.email,
        roleKey: 'platform_owner',
        mfaEnrollmentRequired: true,
        sessionCreated: false,
        tenantContext: null,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : 'Bootstrap failed.';
  if (/\bpassword\b/i.test(message) && process.env.PLATFORM_BOOTSTRAP_PASSWORD_TEST_ONLY) {
    // Keep policy messages; never echo the secret itself.
  }
  const safe =
    typeof message === 'string' &&
    process.env.PLATFORM_BOOTSTRAP_PASSWORD_TEST_ONLY &&
    message.includes(process.env.PLATFORM_BOOTSTRAP_PASSWORD_TEST_ONLY)
      ? 'Bootstrap failed.'
      : message;
  stderr.write(`${safe}\n`);
  process.exitCode = 1;
});
