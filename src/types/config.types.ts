export interface GroupConfig {
  chatId: number;
  name: string;
  onedriveFolderPath: string;
  excelFileName: string;
}

export interface AppConfig {
  groups: GroupConfig[];
}

export interface EnvConfig {
  botToken: string;
  adminUserId: number;
}
