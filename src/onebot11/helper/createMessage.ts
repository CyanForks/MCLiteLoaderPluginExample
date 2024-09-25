import fs from 'node:fs'
import fsPromise from 'node:fs/promises'
import {
  AtType,
  ChatType,
  GroupMemberRole,
  SendMessageElement,
  ElementType
} from '@/ntqqapi/types'
import {
  OB11MessageData,
  OB11MessageDataType,
  OB11MessageFileBase,
  OB11MessageMixType
} from '../types'
import { decodeCQCode } from '../cqcode'
import { Peer } from '@/ntqqapi/types/msg'
import { SendElementEntities } from '@/ntqqapi/entities'
import { selfInfo } from '@/common/globalVars'
import { uri2local } from '@/common/utils'
import { Context } from 'cordis'

export async function createSendElements(
  ctx: Context,
  messageData: OB11MessageData[],
  peer: Peer,
  ignoreTypes: OB11MessageDataType[] = [],
) {
  const sendElements: SendMessageElement[] = []
  const deleteAfterSentFiles: string[] = []
  for (const sendMsg of messageData) {
    if (ignoreTypes.includes(sendMsg.type)) {
      continue
    }
    switch (sendMsg.type) {
      case OB11MessageDataType.text: {
        const text = sendMsg.data?.text
        if (text) {
          sendElements.push(SendElementEntities.text(sendMsg.data!.text))
        }
      }
        break
      case OB11MessageDataType.at: {
        if (!peer) {
          continue
        }
        if (sendMsg.data?.qq) {
          const atQQ = String(sendMsg.data.qq)
          if (atQQ === 'all') {
            // todo：查询剩余的at全体次数
            const groupCode = peer.peerUid
            let remainAtAllCount = 1
            let isAdmin: boolean = true
            if (groupCode) {
              try {
                remainAtAllCount = (await ctx.ntGroupApi.getGroupRemainAtTimes(groupCode)).atInfo
                  .RemainAtAllCountForUin
                ctx.logger.info(`群${groupCode}剩余at全体次数`, remainAtAllCount)
                const self = await ctx.ntGroupApi.getGroupMember(groupCode, selfInfo.uin)
                isAdmin = self?.role === GroupMemberRole.admin || self?.role === GroupMemberRole.owner
              } catch (e) {
              }
            }
            if (isAdmin && remainAtAllCount > 0) {
              sendElements.push(SendElementEntities.at(atQQ, atQQ, AtType.All, '@全体成员'))
            }
          }
          else if (peer.chatType === ChatType.Group) {
            const atMember = await ctx.ntGroupApi.getGroupMember(peer.peerUid, atQQ)
            if (atMember) {
              const display = `@${atMember.cardName || atMember.nick}`
              sendElements.push(
                SendElementEntities.at(atQQ, atMember.uid, AtType.One, display),
              )
            } else {
              const atNmae = sendMsg.data?.name
              const uid = await ctx.ntUserApi.getUidByUin(atQQ) || ''
              const display = atNmae ? `@${atNmae}` : ''
              sendElements.push(
                SendElementEntities.at(atQQ, uid, AtType.One, display),
              )
            }
          }
        }
      }
        break
      case OB11MessageDataType.reply: {
        if (sendMsg.data?.id) {
          const replyMsgId = await ctx.store.getMsgInfoByShortId(+sendMsg.data.id)
          if (!replyMsgId) {
            ctx.logger.warn('回复消息不存在', replyMsgId)
            continue
          }
          const replyMsg = (await ctx.ntMsgApi.getMsgsByMsgId(
            replyMsgId.peer,
            [replyMsgId.msgId!]
          )).msgList[0]
          if (replyMsg) {
            sendElements.push(
              SendElementEntities.reply(
                replyMsg.msgSeq,
                replyMsg.msgId,
                replyMsg.senderUin!,
                replyMsg.senderUin!,
              ),
            )
          }
        }
      }
        break
      case OB11MessageDataType.face: {
        const faceId = sendMsg.data?.id
        if (faceId) {
          sendElements.push(SendElementEntities.face(parseInt(faceId)))
        }
      }
        break
      case OB11MessageDataType.mface: {
        sendElements.push(
          SendElementEntities.mface(
            +sendMsg.data.emoji_package_id,
            sendMsg.data.emoji_id,
            sendMsg.data.key,
            sendMsg.data.summary,
          ),
        )
      }
        break
      case OB11MessageDataType.image: {
        const res = await SendElementEntities.pic(
          ctx,
          (await handleOb11FileLikeMessage(ctx, sendMsg, { deleteAfterSentFiles })).path,
          sendMsg.data.summary || '',
          sendMsg.data.subType || 0,
          sendMsg.data.type === 'flash'
        )
        deleteAfterSentFiles.push(res.picElement.sourcePath!)
        sendElements.push(res)
      }
        break
      case OB11MessageDataType.file: {
        const { path, fileName } = await handleOb11FileLikeMessage(ctx, sendMsg, { deleteAfterSentFiles })
        sendElements.push(await SendElementEntities.file(ctx, path, fileName))
      }
        break
      case OB11MessageDataType.video: {
        const { path, fileName } = await handleOb11FileLikeMessage(ctx, sendMsg, { deleteAfterSentFiles })
        let thumb = sendMsg.data.thumb
        if (thumb) {
          const uri2LocalRes = await uri2local(thumb)
          if (uri2LocalRes.success) thumb = uri2LocalRes.path
        }
        const res = await SendElementEntities.video(ctx, path, fileName, thumb)
        deleteAfterSentFiles.push(res.videoElement.filePath)
        sendElements.push(res)
      }
        break
      case OB11MessageDataType.voice: {
        const { path } = await handleOb11FileLikeMessage(ctx, sendMsg, { deleteAfterSentFiles })
        sendElements.push(await SendElementEntities.ptt(ctx, path))
      }
        break
      case OB11MessageDataType.json: {
        sendElements.push(SendElementEntities.ark(sendMsg.data.data))
      }
        break
      case OB11MessageDataType.dice: {
        const resultId = sendMsg.data?.result
        sendElements.push(SendElementEntities.dice(resultId))
      }
        break
      case OB11MessageDataType.RPS: {
        const resultId = sendMsg.data?.result
        sendElements.push(SendElementEntities.rps(resultId))
      }
        break
      case OB11MessageDataType.contact: {
        const { type, id } = sendMsg.data
        const data = type === 'qq' ? ctx.ntFriendApi.getBuddyRecommendContact(id) : ctx.ntGroupApi.getGroupRecommendContact(id)
        sendElements.push(SendElementEntities.ark(await data))
      }
        break
      case OB11MessageDataType.shake: {
        sendElements.push(SendElementEntities.shake())
      }
        break
    }
  }

  return {
    sendElements,
    deleteAfterSentFiles,
  }
}

// forked from https://github.com/NapNeko/NapCatQQ/blob/6f6b258f22d7563f15d84e7172c4d4cbb547f47e/src/onebot11/action/msg/SendMsg/create-send-elements.ts#L26
async function handleOb11FileLikeMessage(
  ctx: Context,
  { data: inputdata }: OB11MessageFileBase,
  { deleteAfterSentFiles }: { deleteAfterSentFiles: string[] },
) {
  //有的奇怪的框架将url作为参数 而不是file 此时优先url 同时注意可能传入的是非file://开头的目录 By Mlikiowa
  const {
    path,
    isLocal,
    fileName,
    errMsg,
    success,
  } = (await uri2local(inputdata?.url || inputdata.file))

  if (!success) {
    ctx.logger.error(errMsg)
    throw Error(errMsg)
  }

  if (!isLocal) { // 只删除http和base64转过来的文件
    deleteAfterSentFiles.push(path)
  }

  return { path, fileName: inputdata.name || fileName }
}

export function convertMessage2List(message: OB11MessageMixType, autoEscape = false) {
  if (typeof message === 'string') {
    if (autoEscape === true) {
      message = [
        {
          type: OB11MessageDataType.text,
          data: {
            text: message,
          },
        },
      ]
    }
    else {
      message = decodeCQCode(message.toString())
    }
  }
  else if (!Array.isArray(message)) {
    message = [message]
  }
  return message
}

export async function sendMsg(
  ctx: Context,
  peer: Peer,
  sendElements: SendMessageElement[],
  deleteAfterSentFiles: string[]
) {
  if (peer.chatType === ChatType.Group) {
    const info = await ctx.ntGroupApi.getGroupAllInfo(peer.peerUid)
      .catch(() => undefined)
    const shutUpMeTimestamp = info?.groupAll.shutUpMeTimestamp
    if (shutUpMeTimestamp && shutUpMeTimestamp * 1000 > Date.now()) {
      throw new Error('当前处于被禁言状态')
    }
  }
  if (!sendElements.length) {
    throw new Error('消息体无法解析，请检查是否发送了不支持的消息类型')
  }
  // 计算发送的文件大小
  let totalSize = 0
  for (const fileElement of sendElements) {
    try {
      if (fileElement.elementType === ElementType.Ptt) {
        totalSize += fs.statSync(fileElement.pttElement.filePath!).size
      }
      if (fileElement.elementType === ElementType.File) {
        totalSize += fs.statSync(fileElement.fileElement.filePath).size
      }
      if (fileElement.elementType === ElementType.Video) {
        totalSize += fs.statSync(fileElement.videoElement.filePath).size
      }
      if (fileElement.elementType === ElementType.Pic) {
        totalSize += fs.statSync(fileElement.picElement.sourcePath!).size
      }
    } catch (e) {
      ctx.logger.warn('文件大小计算失败', e, fileElement)
    }
  }
  //log('发送消息总大小', totalSize, 'bytes')
  const timeout = 10000 + (totalSize / 1024 / 256 * 1000)  // 10s Basic Timeout + PredictTime( For File 512kb/s )
  //log('设置消息超时时间', timeout)
  const returnMsg = await ctx.ntMsgApi.sendMsg(peer, sendElements, timeout)
  if (returnMsg) {
    ctx.logger.info('消息发送', peer)
    deleteAfterSentFiles.map(path => fsPromise.unlink(path))
    return returnMsg
  }
}

export interface CreatePeerPayload {
  group_id?: string | number
  user_id?: string | number
}

export enum CreatePeerMode {
  Normal = 0,
  Private = 1,
  Group = 2
}

export async function createPeer(ctx: Context, payload: CreatePeerPayload, mode = CreatePeerMode.Normal): Promise<Peer> {
  if ((mode === CreatePeerMode.Group || mode === CreatePeerMode.Normal) && payload.group_id) {
    return {
      chatType: ChatType.Group,
      peerUid: payload.group_id.toString(),
    }
  }
  if ((mode === CreatePeerMode.Private || mode === CreatePeerMode.Normal) && payload.user_id) {
    const uid = await ctx.ntUserApi.getUidByUin(payload.user_id.toString())
    if (!uid) throw new Error('无法获取用户信息')
    const isBuddy = await ctx.ntFriendApi.isBuddy(uid)
    return {
      chatType: isBuddy ? ChatType.C2C : ChatType.TempC2CFromGroup,
      peerUid: uid,
    }
  }
  throw new Error('请指定 group_id 或 user_id')
}
