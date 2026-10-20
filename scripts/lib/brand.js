// Product identity. The engine keeps rsc's `.rsc` state and command vocabulary for compatibility;
// what a person copies into a shell is this package's own invocation.
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

export const PRODUCT_NAME = 'rea-harness';
export const PACKAGE_NAME = 'rea-harness';
export const CLI_VERSION = pkg.version;
export const REPOSITORY = 'github:igutiez/rea-harness';
export const CLI_INVOCATION = `npx ${REPOSITORY}`;
// A git tag, not `@latest`: the plan id is a hash of this catalog, so the command that re-creates it
// must name the release that produced it.
export const CLI_INVOCATION_PINNED = `${CLI_INVOCATION}#v${CLI_VERSION}`;
export const REA_INVOCATION = `${CLI_INVOCATION} rea`;
