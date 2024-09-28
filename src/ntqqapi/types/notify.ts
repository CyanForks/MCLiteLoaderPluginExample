export enum GroupNotifyType {
  INVITED_BY_MEMBER = 1,
  REFUSE_INVITED,
  REFUSED_BY_ADMINI_STRATOR,
  AGREED_TOJOIN_DIRECT, // 有人接受了邀请入群
  INVITED_NEED_ADMINI_STRATOR_PASS, // 有人邀请了别人入群
  AGREED_TO_JOIN_BY_ADMINI_STRATOR,
  REQUEST_JOIN_NEED_ADMINI_STRATOR_PASS,
  SET_ADMIN,
  KICK_MEMBER_NOTIFY_ADMIN,
  KICK_MEMBER_NOTIFY_KICKED,
  MEMBER_LEAVE_NOTIFY_ADMIN, // 主动退出
  CANCEL_ADMIN_NOTIFY_CANCELED, // 我被取消管理员
  CANCEL_ADMIN_NOTIFY_ADMIN, // 其他人取消管理员
  TRANSFER_GROUP_NOTIFY_OLDOWNER,
  TRANSFER_GROUP_NOTIFY_ADMIN
}

export interface GroupNotifies {
  doubt: boolean
  nextStartSeq: string
  notifies: GroupNotify[]
}

export enum GroupNotifyStatus {
  KINIT, // 初始化
  KUNHANDLE, // 未处理
  KAGREED, // 同意
  KREFUSED, // 拒绝
  KIGNORED // 忽略
}

export interface GroupNotify {
  time: number // 自己添加的字段，时间戳，毫秒, 用于判断收到短时间内收到重复的notify
  seq: string // 唯一标识符，转成数字再除以1000应该就是时间戳？
  type: GroupNotifyType
  status: GroupNotifyStatus
  group: { groupCode: string; groupName: string }
  user1: { uid: string; nickName: string } // 被设置管理员的人
  user2: { uid: string; nickName: string } // 操作者
  actionUser: { uid: string; nickName: string } //未知
  actionTime: string
  invitationExt: {
    srcType: number // 0?未知
    groupCode: string
    waitStatus: number
  }
  postscript: string // 加群用户填写的验证信息
  repeatSeqs: []
  warningTips: string
}

export enum GroupRequestOperateTypes {
  approve = 1,
  reject = 2,
}

export enum BuddyReqType {
  MsgInfo = 12,
  MeInitiatorWaitPeerConfirm = 13,
}

export interface FriendRequest {
  isInitiator?: boolean
  isDecide: boolean
  friendUid: string
  reqType: BuddyReqType
  reqTime: string // 时间戳,秒
  extWords: string // 申请人填写的验证消息
  isUnread: boolean
  friendNick: string
  sourceId: number
  groupCode: string
}

export interface FriendRequestNotify {
  data: {
    unreadNums: number
    buddyReqs: FriendRequest[]
  }
}

export enum MemberExtSourceType {
  DEFAULTTYPE = 0,
  TITLETYPE = 1,
  NEWGROUPTYPE = 2,
}

export interface GroupExtParam {
  groupCode: string
  seq: string
  beginUin: string
  dataTime: string
  uinList: Array<string>
  uinNum: string
  groupType: string
  richCardNameVer: string
  sourceType: MemberExtSourceType
  memberExtFilter: {
    memberLevelInfoUin: number
    memberLevelInfoPoint: number
    memberLevelInfoActiveDay: number
    memberLevelInfoLevel: number
    memberLevelInfoName: number
    levelName: number
    dataTime: number
    userShowFlag: number
    sysShowFlag: number
    timeToUpdate: number
    nickName: number
    specialTitle: number
    levelNameNew: number
    userShowFlagNew: number
    msgNeedField: number
    cmdUinFlagExt3Grocery: number
    memberIcon: number
    memberInfoSeq: number
  }
}
