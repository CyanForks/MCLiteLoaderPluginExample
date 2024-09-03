import BaseAction from '../BaseAction'
import { OB11Message } from '../../types'
import { ActionName } from '../types'
import { ChatType } from '@/ntqqapi/types'
import { OB11Entities } from '../../entities'
import { RawMessage } from '@/ntqqapi/types'
import { MessageUnique } from '@/common/utils/messageUnique'

interface Payload {
  group_id: number | string
  message_seq?: number | string
  count?: number | string
  reverseOrder?: boolean
}

interface Response {
  messages: OB11Message[]
}

export class GetGroupMsgHistory extends BaseAction<Payload, Response> {
  actionName = ActionName.GoCQHTTP_GetGroupMsgHistory

  protected async _handle(payload: Payload): Promise<Response> {
    const count = payload.count || 20
    const isReverseOrder = payload.reverseOrder || true
    const peer = { chatType: ChatType.group, peerUid: payload.group_id.toString() }
    let msgList: RawMessage[] | undefined
    // 包含 message_seq 0
    if (!payload.message_seq) {
      msgList = (await this.ctx.ntMsgApi.getAioFirstViewLatestMsgs(peer, +count)).msgList
    } else {
      const startMsgId = (await MessageUnique.getMsgIdAndPeerByShortId(+payload.message_seq))?.MsgId
      if (!startMsgId) throw new Error(`消息${payload.message_seq}不存在`)
      msgList = (await this.ctx.ntMsgApi.getMsgHistory(peer, startMsgId, +count)).msgList
    }
    if (!msgList?.length) throw new Error('未找到消息')
    if (isReverseOrder) msgList.reverse()
    await Promise.all(
      msgList.map(async msg => {
        msg.msgShortId = MessageUnique.createMsg({ chatType: msg.chatType, peerUid: msg.peerUid }, msg.msgId)
      })
    )
    const ob11MsgList = await Promise.all(msgList.map((msg) => OB11Entities.message(this.ctx, msg)))
    return { messages: ob11MsgList }
  }
}
