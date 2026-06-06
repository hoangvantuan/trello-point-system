// Khai báo tối thiểu cho object `t` mà Trello truyền vào.
// Không dùng @types chính thức để giữ phụ thuộc gọn.
export interface TrelloMember {
  id: string;
  username: string;
  fullName: string;
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
  popup?(opts: { title: string; url: string; height?: number }): void;
}
