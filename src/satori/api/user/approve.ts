import { Handler } from '../index'
import { Dict } from 'cosmokit'
import { ChatType } from '@/ntqqapi/types'

interface Payload {
  message_id: string
  approve: boolean
  comment?: string
}

export const handleFriendRequest: Handler<Dict<never>, Payload> = async (ctx, payload) => {
  const data = payload.message_id.split('|')
  if (data.length < 2) {
    throw new Error('无效的 message_id')
  }
  const uid = data[0]
  const reqTime = data[1]
  await ctx.ntFriendApi.handleFriendRequest(uid, reqTime, payload.approve)
  await ctx.ntMsgApi.activateChat({
    peerUid: uid,
    chatType: ChatType.C2C,
    guildId: ''
  })
  return {}
}
