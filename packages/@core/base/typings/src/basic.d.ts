interface BasicOption {
  label: string;
  value: string;
}

type SelectOption = BasicOption;

type TabOption = BasicOption;

interface BasicUserInfo {
  /** 用户邮箱 */
  email?: string;
  /**
   * 头像
   */
  avatar: string;
  /**
   * 用户昵称
   */
  real_name: string;
  /**
   * 用户角色
   */
  roles?: string[];
  /**
   * 用户id
   */
  id: number;
  /**
   * 用户名
   */
  username: string;
}

export type { BasicOption, BasicUserInfo, SelectOption, TabOption };
