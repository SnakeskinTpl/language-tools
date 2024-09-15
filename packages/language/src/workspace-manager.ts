import { DefaultWorkspaceManager } from "langium"

export class SnakeskinWorkspaceManager extends DefaultWorkspaceManager {
  get workspaceFolders() {
    return this.folders ?? [];
  }
}
