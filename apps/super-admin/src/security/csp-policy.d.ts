/**
 * Super Admin Content-Security-Policy — canonical SSOT.
 * Keep apps/super-admin/index.html meta CSP identical to SUPER_ADMIN_CSP_POLICY.
 * Vite preview/dev headers import this value (see vite.config.ts).
 */
export declare const SUPER_ADMIN_CSP_POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' ws://127.0.0.1:5176 ws://localhost:5176 ws: wss: http://127.0.0.1:3000 http://localhost:3000; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
/** Ownership / enforcement boundaries for production static hosting. */
export declare const CSP_OWNERSHIP: {
    readonly productionServingOwner: "deployment-external (not in this repository — no nginx/CDN/Dockerfile for Super Admin static hosting)";
    readonly cspEnforcementOwner: "HTML meta CSP shipped in index.html (repository) + Vite preview/dev headers; production edge headers REQUIRED of deploy owner";
    readonly repositoryConfig: "apps/super-admin/index.html meta + apps/super-admin/vite.config.ts + this SSOT";
    readonly productionCspPresent: "repository ships meta CSP in built index.html; edge header enforcement is deployment-owned";
};
/** Parse a CSP policy string into directive → token list. */
export declare function parseCspDirectives(policy: string): Record<string, string[]>;
