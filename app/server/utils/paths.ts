import path from "node:path";
import { fileURLToPath } from "node:url";

// __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// paths.ts is at <repo>/app/server/utils/paths.ts
const serverRoot = path.resolve(__dirname, ".."); // <repo>/app/server
const appRoot = path.resolve(serverRoot, ".."); // <repo>/app
const repoRoot = path.resolve(appRoot, ".."); // <repo>

// repo root がワークスペース
const workspaceRoot = repoRoot;

export const resolveRepoRoot = () => repoRoot;
export const resolveAppRoot = () => appRoot;
export const resolveServerRoot = () => serverRoot;
export const resolveSharedRoot = () => path.join(repoRoot, "shared");

// inhabitantIdは無視して常にworkspaceRootを返す
export const resolveInhabitantWorkspace = (_inhabitantId: string) => workspaceRoot;
export const resolveInhabitantChatsRoot = (_inhabitantId: string) =>
  path.join(workspaceRoot, "chats");
export const resolveChatIndexPath = (inhabitantId: string) =>
  path.join(resolveInhabitantChatsRoot(inhabitantId), "index.json");
export const resolveChatFilePath = (inhabitantId: string, chatId: string) =>
  path.join(resolveInhabitantChatsRoot(inhabitantId), `${chatId}.json`);
export const resolveOutputStylesRoot = () =>
  path.join(resolveSharedRoot(), "output-styles");

export const resolveInhabitantConfig = (inhabitantId: string) =>
  path.join(resolveInhabitantWorkspace(inhabitantId), ".claude", "config.json");
