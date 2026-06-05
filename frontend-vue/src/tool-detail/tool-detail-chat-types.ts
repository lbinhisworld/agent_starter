/**
 * [OUTPUT]: 工具详情页聊天消息类型
 * [POS]: `useToolDetailSession` / `tool-detail-chat-persist`
 */

export type ToolDetailChatSub = {
  kind: 'user_input' | 'extract_result';
  fullText: string;
  revealedLen: number;
  revealDone?: boolean;
  revealInProgress?: boolean;
};

export type ToolDetailIntegrateStatus = 'pending' | 'yes' | 'no';

export type ToolDetailChatMsg = {
  key: string;
  role: 'user' | 'assistant';
  content?: string;
  parsing?: boolean;
  lineText?: string;
  kind?: 'tool-received' | 'tool-extracting' | 'tool-integrate-prompt';
  sub?: ToolDetailChatSub;
  /** 整合确认：对应工具 id */
  sourceToolId?: string;
  integrateStatus?: ToolDetailIntegrateStatus;
  /** 待整合的 L0.5 JSON 快照（pending 时写入，避免用户再次提炼后串数据） */
  integrateParsed?: Record<string, unknown> | null;
};
