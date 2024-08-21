import GetMsg from './msg/GetMsg'
import GetLoginInfo from './system/GetLoginInfo'
import { GetFriendList, GetFriendWithCategory } from './user/GetFriendList'
import GetGroupList from './group/GetGroupList'
import GetGroupInfo from './group/GetGroupInfo'
import GetGroupMemberList from './group/GetGroupMemberList'
import GetGroupMemberInfo from './group/GetGroupMemberInfo'
import SendGroupMsg from './group/SendGroupMsg'
import SendPrivateMsg from './msg/SendPrivateMsg'
import SendMsg from './msg/SendMsg'
import DeleteMsg from './msg/DeleteMsg'
import BaseAction from './BaseAction'
import GetVersionInfo from './system/GetVersionInfo'
import CanSendRecord from './system/CanSendRecord'
import CanSendImage from './system/CanSendImage'
import GetStatus from './system/GetStatus'
import {
  GoCQHTTPSendForwardMsg,
  GoCQHTTPSendGroupForwardMsg,
  GoCQHTTPSendPrivateForwardMsg,
} from './go-cqhttp/SendForwardMsg'
import GoCQHTTPGetStrangerInfo from './go-cqhttp/GetStrangerInfo'
import SendLike from './user/SendLike'
import SetGroupAddRequest from './group/SetGroupAddRequest'
import SetGroupLeave from './group/SetGroupLeave'
import GetGuildList from './group/GetGuildList'
import Debug from './llonebot/Debug'
import SetFriendAddRequest from './user/SetFriendAddRequest'
import SetGroupWholeBan from './group/SetGroupWholeBan'
import SetGroupName from './group/SetGroupName'
import SetGroupBan from './group/SetGroupBan'
import SetGroupKick from './group/SetGroupKick'
import SetGroupAdmin from './group/SetGroupAdmin'
import SetGroupCard from './group/SetGroupCard'
import GetImage from './file/GetImage'
import GetRecord from './file/GetRecord'
import GoCQHTTPMarkMsgAsRead from './msg/MarkMsgAsRead'
import CleanCache from './system/CleanCache'
import { GoCQHTTPUploadGroupFile, GoCQHTTPUploadPrivateFile } from './go-cqhttp/UploadFile'
import { GetConfigAction, SetConfigAction } from './llonebot/Config'
import GetGroupAddRequest from './llonebot/GetGroupAddRequest'
import SetQQAvatar from './llonebot/SetQQAvatar'
import GoCQHTTPDownloadFile from './go-cqhttp/DownloadFile'
import GoCQHTTPGetGroupMsgHistory from './go-cqhttp/GetGroupMsgHistory'
import GetFile from './file/GetFile'
import { GoCQHTTGetForwardMsgAction } from './go-cqhttp/GetForwardMsg'
import { GetCookies } from './user/GetCookie'
import { SetMsgEmojiLike } from './msg/SetMsgEmojiLike'
import { ForwardFriendSingleMsg, ForwardGroupSingleMsg } from './msg/ForwardSingleMsg'
import { GetGroupEssence } from './group/GetGroupEssence'
import { GetGroupHonorInfo } from './group/GetGroupHonorInfo'
import { GoCQHTTHandleQuickOperation } from './go-cqhttp/QuickOperation'
import GoCQHTTPSetEssenceMsg from './go-cqhttp/SetEssenceMsg'
import GoCQHTTPDelEssenceMsg from './go-cqhttp/DelEssenceMsg'
import GetEvent from './llonebot/GetEvent'
import { GoCQHTTPDelGroupFile } from './go-cqhttp/DelGroupFile'


export const actionHandlers = [
  new GetFile(),
  new Debug(),
  new GetConfigAction(),
  new SetConfigAction(),
  new GetGroupAddRequest(),
  new SetQQAvatar(),
  new GetFriendWithCategory(),
  new GetEvent(),
  // onebot11
  new SendLike(),
  new GetMsg(),
  new GetLoginInfo(),
  new GetFriendList(),
  new GetGroupList(),
  new GetGroupInfo(),
  new GetGroupMemberList(),
  new GetGroupMemberInfo(),
  new SendGroupMsg(),
  new SendPrivateMsg(),
  new SendMsg(),
  new DeleteMsg(),
  new SetGroupAddRequest(),
  new SetFriendAddRequest(),
  new SetGroupLeave(),
  new GetVersionInfo(),
  new CanSendRecord(),
  new CanSendImage(),
  new GetStatus(),
  new SetGroupWholeBan(),
  new SetGroupBan(),
  new SetGroupKick(),
  new SetGroupAdmin(),
  new SetGroupName(),
  new SetGroupCard(),
  new GetImage(),
  new GetRecord(),
  new CleanCache(),
  new GetCookies(),
  new SetMsgEmojiLike(),
  new ForwardFriendSingleMsg(),
  new ForwardGroupSingleMsg(),
  //以下为go-cqhttp api
  new GetGroupEssence(),
  new GetGroupHonorInfo(),
  new GoCQHTTPSendForwardMsg(),
  new GoCQHTTPSendGroupForwardMsg(),
  new GoCQHTTPSendPrivateForwardMsg(),
  new GoCQHTTPGetStrangerInfo(),
  new GoCQHTTPDownloadFile(),
  new GetGuildList(),
  new GoCQHTTPMarkMsgAsRead(),
  new GoCQHTTPUploadGroupFile(),
  new GoCQHTTPUploadPrivateFile(),
  new GoCQHTTPGetGroupMsgHistory(),
  new GoCQHTTGetForwardMsgAction(),
  new GoCQHTTHandleQuickOperation(),
  new GoCQHTTPSetEssenceMsg(),
  new GoCQHTTPDelEssenceMsg(),
  new GoCQHTTPDelGroupFile()
]

function initActionMap() {
  const actionMap = new Map<string, BaseAction<any, any>>()
  for (const action of actionHandlers) {
    actionMap.set(action.actionName, action)
    actionMap.set(action.actionName + '_async', action)
    actionMap.set(action.actionName + '_rate_limited', action)
  }

  return actionMap
}

export const actionMap = initActionMap()
