// Khai báo tối thiểu cho object `t` mà Trello truyền vào.
// Không dùng @types chính thức để giữ phụ thuộc gọn.
export interface TrelloMember {
  id: string;
  username: string;
  fullName: string;
}

// Client REST của Power-Up (t.getRestApi()). Mỗi member tự cấp token đọc của mình.
export interface TrelloRestApi {
  getToken(): Promise<string | null>;
  authorize(opts: { scope: string; expiration: string }): Promise<string>;
  clearToken(): Promise<void>;
}

export interface TrelloT {
  get(scope: 'card', visibility: 'shared'): Promise<Record<string, unknown>>;
  set(scope: 'card', visibility: 'shared', key: string, value: unknown): Promise<void>;
  remove(scope: 'card', visibility: 'shared', key: string): Promise<void>;
  member(
    ...fields: Array<'id' | 'username' | 'fullName'>
  ): Promise<TrelloMember>;
  render?(): Promise<void>;
  sizeTo?(selector: string): Promise<void>;
  signUrl?(url: string, opts?: { arg?: string }): string;
  popup?(opts: { title: string; url: string; height?: number }): void;
  modal?(opts: {
    title: string;
    url: string;
    fullscreen?: boolean;
    height?: number;
  }): void;
  getRestApi?(): TrelloRestApi | Promise<TrelloRestApi>;
  getContext?(): { board: string; card?: string; member?: string };
}
