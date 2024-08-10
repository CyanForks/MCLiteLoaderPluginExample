// handle quick action, create at 2024-5-18 10:54:39 by linyuchen


import { OB11Message, OB11MessageAt, OB11MessageData, OB11MessageDataType } from '../types'
import { OB11FriendRequestEvent } from '../event/request/OB11FriendRequest'
import { OB11GroupRequestEvent } from '../event/request/OB11GroupRequest'
import { dbUtil } from '@/common/db'
import { NTQQFriendApi, NTQQGroupApi, NTQQMsgApi, NTQQUserApi } from '@/ntqqapi/api'
import { ChatType, GroupRequestOperateTypes, Peer } from '@/ntqqapi/types'
import { convertMessage2List, createSendElements, sendMsg } from './msg/SendMsg'
import { isNull, log } from '@/common/utils'
import { getConfigUtil } from '@/common/config'


interface QuickOperationPrivateMessage {
  reply?: string
  auto_escape?: boolean
}

interface QuickOperationGroupMessage extends QuickOperationPrivateMessage {
  // 回复群消息
  at_sender?: boolean
  delete?: boolean
  kick?: boolean
  ban?: boolean
  ban_duration?: number
  //
}

interface QuickOperationFriendRequest {
  approve?: boolean
  remark?: string
}

interface QuickOperationGroupRequest {
  approve?: boolean
  reason?: string
}

export type QuickOperation = QuickOperationPrivateMessage &
  QuickOperationGroupMessage &
  QuickOperationFriendRequest &
  QuickOperationGroupRequest

export type QuickOperationEvent = OB11Message | OB11FriendRequestEvent | OB11GroupRequestEvent;

export async function handleQuickOperation(context: QuickOperationEvent, quickAction: QuickOperation) {
  if (context.post_type === 'message') {
    handleMsg(context as OB11Message, quickAction).then().catch(log)
  }
  if (context.post_type === 'request') {
    const friendRequest = context as OB11FriendRequestEvent
    const groupRequest = context as OB11GroupRequestEvent
    if ((friendRequest).request_type === 'friend') {
      handleFriendRequest(friendRequest, quickAction).then().catch(log)
    }
    else if (groupRequest.request_type === 'group') {
      handleGroupRequest(groupRequest, quickAction).then().catch(log)
    }
  }
}

async function handleMsg(msg: OB11Message, quickAction: QuickOperationPrivateMessage | QuickOperationGroupMessage) {
  const rawMessage = await dbUtil.getMsgByShortId(msg.message_id)
  const reply = quickAction.reply
  const ob11Config = getConfigUtil().getConfig().ob11
  const peer: Peer = {
    chatType: ChatType.friend,
    peerUid: msg.user_id.toString(),
  }
  if (msg.message_type == 'private') {
    peer.peerUid = (await NTQQUserApi.getUidByUin(msg.user_id.toString()))!
    if (msg.sub_type === 'group') {
      peer.chatType = ChatType.temp
    }
  }
  else {
    peer.chatType = ChatType.group
    peer.peerUid = msg.group_id?.toString()!
  }
  if (reply) {
    let replyMessage: OB11MessageData[] = []
    if (ob11Config.enableQOAutoQuote) {
      replyMessage.push({
        type: OB11MessageDataType.reply,
        data: {
          id: msg.message_id.toString(),
        },
      })
    }

    if (msg.message_type == 'group') {
      if ((quickAction as QuickOperationGroupMessage).at_sender) {
        replyMessage.push({
          type: 'at',
          data: {
            qq: msg.user_id.toString(),
          },
        } as OB11MessageAt)
      }
    }
    replyMessage = replyMessage.concat(convertMessage2List(reply, quickAction.auto_escape))
    const { sendElements, deleteAfterSentFiles } = await createSendElements(replyMessage, peer)
    sendMsg(peer, sendElements, deleteAfterSentFiles, false).then().catch(log)
  }
  if (msg.message_type === 'group') {
    const groupMsgQuickAction = quickAction as QuickOperationGroupMessage
    // handle group msg
    if (groupMsgQuickAction.delete) {
      NTQQMsgApi.recallMsg(peer, [rawMessage?.msgId!]).then().catch(log)
    }
    if (groupMsgQuickAction.kick) {
      NTQQGroupApi.kickMember(peer.peerUid, [rawMessage?.senderUid!]).then().catch(log)
    }
    if (groupMsgQuickAction.ban) {
      NTQQGroupApi.banMember(peer.peerUid, [
        {
          uid: rawMessage?.senderUid!,
          timeStamp: groupMsgQuickAction.ban_duration || 60 * 30,
        },
      ]).then().catch(log)
    }
  }
}

async function handleFriendRequest(request: OB11FriendRequestEvent,
  quickAction: QuickOperationFriendRequest) {
  if (!isNull(quickAction.approve)) {
    // todo: set remark
    NTQQFriendApi.handleFriendRequest(request.flag, quickAction.approve).then().catch(log)
  }
}


async function handleGroupRequest(request: OB11GroupRequestEvent,
  quickAction: QuickOperationGroupRequest) {
  if (!isNull(quickAction.approve)) {
    NTQQGroupApi.handleGroupRequest(
      request.flag,
      quickAction.approve ? GroupRequestOperateTypes.approve : GroupRequestOperateTypes.reject,
      quickAction.reason,
    ).then().catch(log)
  }
}