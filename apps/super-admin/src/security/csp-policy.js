/**
 * Super Admin Content-Security-Policy — canonical SSOT.
 * Keep apps/super-admin/index.html meta CSP identical to SUPER_ADMIN_CSP_POLICY.
 * Vite preview/dev headers import this value (see vite.config.ts).
 */
export var SUPER_ADMIN_CSP_POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' ws://127.0.0.1:5176 ws://localhost:5176 ws: wss: http://127.0.0.1:3000 http://localhost:3000; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
/** Ownership / enforcement boundaries for production static hosting. */
export var CSP_OWNERSHIP = {
    productionServingOwner: 'deployment-external (not in this repository — no nginx/CDN/Dockerfile for Super Admin static hosting)',
    cspEnforcementOwner: 'HTML meta CSP shipped in index.html (repository) + Vite preview/dev headers; production edge headers REQUIRED of deploy owner',
    repositoryConfig: 'apps/super-admin/index.html meta + apps/super-admin/vite.config.ts + this SSOT',
    productionCspPresent: 'repository ships meta CSP in built index.html; edge header enforcement is deployment-owned',
};
/** Parse a CSP policy string into directive → token list. */
export function parseCspDirectives(policy) {
    var out = {};
    for (var _i = 0, _a = policy.split(';'); _i < _a.length; _i++) {
        var part = _a[_i];
        var trimmed = part.trim();
        if (!trimmed)
            continue;
        var _b = trimmed.split(/\s+/), name_1 = _b[0], rest = _b.slice(1);
        if (!name_1)
            continue;
        out[name_1] = rest;
    }
    return out;
}
