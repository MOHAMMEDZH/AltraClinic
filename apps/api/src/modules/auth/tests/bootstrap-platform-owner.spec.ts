import { spawn } from 'child_process';
import path from 'path';

const script = path.resolve(__dirname, '../../../../scripts/bootstrap-platform-owner.mjs');

function runBootstrap(env: NodeJS.ProcessEnv, args: string[] = [], stdinText?: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });
    if (stdinText != null) {
      child.stdin.write(stdinText);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('bootstrap-platform-owner CLI security', () => {
  const secret = 'SuperSecretBootstrapPass1!';

  it('rejects password as a command-line argument', async () => {
    const result = await runBootstrap(
      { NODE_ENV: 'development' },
      ['--email', 'owner@example.com', '--password', secret],
    );
    expect(result.code).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/must not be supplied as a command-line argument/i);
    expect(result.stderr + result.stdout).not.toContain(secret);
  });

  it('rejects ordinary PLATFORM_BOOTSTRAP_PASSWORD outside tests', async () => {
    const result = await runBootstrap(
      {
        NODE_ENV: 'development',
        PLATFORM_BOOTSTRAP_PASSWORD: secret,
      },
      ['--email', 'owner@example.com', '--password-stdin'],
      `${secret}\n${secret}\n`,
    );
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/not accepted outside NODE_ENV=test/i);
    expect(result.stderr + result.stdout).not.toContain(secret);
  });

  it('rejects empty password via stdin', async () => {
    const result = await runBootstrap(
      { NODE_ENV: 'test', PLATFORM_BOOTSTRAP_PASSWORD_TEST_ONLY: '' },
      ['--email', 'owner@example.com'],
    );
    expect(result.code).not.toBe(0);
    expect(result.stderr + result.stdout).not.toMatch(/PLATFORM_BOOTSTRAP_PASSWORD_TEST_ONLY=.+/);
  });

  it('rejects password confirmation mismatch via stdin', async () => {
    const result = await runBootstrap(
      { NODE_ENV: 'development' },
      ['--email', 'owner@example.com', '--password-stdin'],
      `${secret}\nother-password-xx\n`,
    );
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/confirmation does not match/i);
    expect(result.stderr + result.stdout).not.toContain(secret);
  });

  it('help text contains no insecure password examples', async () => {
    const result = await runBootstrap({ NODE_ENV: 'test' }, ['--help']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('--password-stdin');
    expect(result.stdout).not.toContain('PLATFORM_BOOTSTRAP_PASSWORD=');
    expect(result.stdout).not.toMatch(/--password\s+\S+/);
  });

  it('test-only password injection is refused when NODE_ENV is not test', async () => {
    const result = await runBootstrap(
      {
        NODE_ENV: 'production',
        PLATFORM_BOOTSTRAP_PASSWORD_TEST_ONLY: secret,
      },
      ['--email', 'owner@example.com'],
    );
    expect(result.code).not.toBe(0);
    expect(result.stderr + result.stdout).not.toContain(secret);
  });
});
