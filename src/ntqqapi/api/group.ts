import { ReceiveCmdS } from '../hook'
import {
  Group,
  GroupMember,
  GroupMemberRole,
  GroupNotifies,
  GroupRequestOperateTypes,
  GetFileListParam,
  PublishGroupBulletinReq,
  GroupAllInfo,
  GroupFileInfo,
  GroupBulletinListResult
} from '../types'
import { invoke, NTClass, NTMethod } from '../ntcall'
import { GeneralCallResult } from '../services'
import { NTQQWindows } from './window'
import { getSession } from '../wrapper'
import { Service, Context } from 'cordis'

declare module 'cordis' {
  interface Context {
    ntGroupApi: NTQQGroupApi
  }
}

export class NTQQGroupApi extends Service {
  static inject = ['ntWindowApi']

  constructor(protected ctx: Context) {
    super(ctx, 'ntGroupApi', true)
  }

  async getGroups(): Promise<Group[]> {
    const result = await invoke<{
      updateType: number
      groupList: Group[]
    }>(
      'getGroupList',
      [],
      {
        className: NTClass.NODE_STORE_API,
        cbCmd: ReceiveCmdS.GROUPS_STORE,
        afterFirstCmd: false,
      }
    )
    return result.groupList
  }

  async getGroupMembers(groupCode: string, num = 3000): Promise<Map<string, GroupMember>> {
    const sceneId = await invoke(NTMethod.GROUP_MEMBER_SCENE, [{ groupCode, scene: 'groupMemberList_MainWindow' }])
    const data = await invoke(NTMethod.GROUP_MEMBERS, [{ sceneId, num }])
    if (data.errCode !== 0) {
      throw new Error('获取群成员列表出错,' + data.errMsg)
    }
    return data.result.infos
  }

  async getGroupMember(groupCode: string, uid: string, forceUpdate = false) {
    invoke('nodeIKernelGroupListener/onMemberInfoChange', [], {
      registerEvent: true
    })

    const data = await invoke<{
      groupCode: string
      members: Map<string, GroupMember>
    }>(
      'nodeIKernelGroupService/getMemberInfo',
      [{
        groupCode,
        uids: [uid],
        forceUpdate
      }],
      {
        cbCmd: 'nodeIKernelGroupListener/onMemberInfoChange',
        afterFirstCmd: false,
        cmdCB: payload => payload.members.has(uid),
        timeout: 2000
      }
    )
    return data.members.get(uid)!
  }

  async getGroupIgnoreNotifies() {
    await this.getSingleScreenNotifies(14)
    return await this.ctx.ntWindowApi.openWindow<GeneralCallResult & GroupNotifies>(
      NTQQWindows.GroupNotifyFilterWindow,
      [],
      ReceiveCmdS.GROUP_NOTIFY,
    )
  }

  async getSingleScreenNotifies(number: number, startSeq = '') {
    invoke(ReceiveCmdS.GROUP_NOTIFY, [], { registerEvent: true })

    return (await invoke<GroupNotifies>(
      'nodeIKernelGroupService/getSingleScreenNotifies',
      [{ doubt: false, startSeq, number }],
      {
        cbCmd: ReceiveCmdS.GROUP_NOTIFY,
        afterFirstCmd: false,
      }
    )).notifies
  }

  async handleGroupRequest(flag: string, operateType: GroupRequestOperateTypes, reason?: string) {
    const flagitem = flag.split('|')
    const groupCode = flagitem[0]
    const seq = flagitem[1]
    const type = parseInt(flagitem[2])
    return await invoke(NTMethod.HANDLE_GROUP_REQUEST, [{
      doubt: false,
      operateMsg: {
        operateType,
        targetMsg: {
          seq,
          type,
          groupCode,
          postscript: reason || ' ' // 仅传空值可能导致处理失败，故默认给个空格
        },
      },
    }])
  }

  async quitGroup(groupCode: string) {
    return await invoke(NTMethod.QUIT_GROUP, [{ groupCode }])
  }

  async kickMember(groupCode: string, kickUids: string[], refuseForever = false, kickReason = '') {
    return await invoke(NTMethod.KICK_MEMBER, [{ groupCode, kickUids, refuseForever, kickReason }])
  }

  /** timeStamp为秒数, 0为解除禁言 */
  async banMember(groupCode: string, memList: Array<{ uid: string, timeStamp: number }>) {
    return await invoke(NTMethod.MUTE_MEMBER, [{ groupCode, memList }])
  }

  async banGroup(groupCode: string, shutUp: boolean) {
    return await invoke(NTMethod.MUTE_GROUP, [{ groupCode, shutUp }])
  }

  async setMemberCard(groupCode: string, memberUid: string, cardName: string) {
    const session = getSession()
    if (session) {
      return session.getGroupService().modifyMemberCardName(groupCode, memberUid, cardName)
    } else {
      return await invoke(NTMethod.SET_MEMBER_CARD, [{ groupCode, uid: memberUid, cardName }])
    }
  }

  async setMemberRole(groupCode: string, memberUid: string, role: GroupMemberRole) {
    const session = getSession()
    if (session) {
      return session.getGroupService().modifyMemberRole(groupCode, memberUid, role)
    } else {
      return await invoke(NTMethod.SET_MEMBER_ROLE, [{ groupCode, uid: memberUid, role }])
    }
  }

  async setGroupName(groupCode: string, groupName: string) {
    return await invoke(NTMethod.SET_GROUP_NAME, [{ groupCode, groupName }])
  }

  async getGroupRemainAtTimes(groupCode: string) {
    return await invoke(NTMethod.GROUP_AT_ALL_REMAIN_COUNT, [{ groupCode }])
  }

  async removeGroupEssence(groupCode: string, msgId: string) {
    const session = getSession()
    if (session) {
      const data = await session.getMsgService().getMsgsIncludeSelf({ chatType: 2, guildId: '', peerUid: groupCode }, msgId, 1, false)
      return session.getGroupService().removeGroupEssence({
        groupCode: groupCode,
        msgRandom: Number(data?.msgList[0].msgRandom),
        msgSeq: Number(data?.msgList[0].msgSeq)
      })
    } else {
      const ntMsgApi = this.ctx.get('ntMsgApi')!
      const data = await ntMsgApi.getMsgHistory({ chatType: 2, guildId: '', peerUid: groupCode }, msgId, 1, false)
      return await invoke('nodeIKernelGroupService/removeGroupEssence', [{
        req: {
          groupCode: groupCode,
          msgRandom: Number(data?.msgList[0].msgRandom),
          msgSeq: Number(data?.msgList[0].msgSeq)
        }
      }])
    }
  }

  async addGroupEssence(groupCode: string, msgId: string) {
    const session = getSession()
    if (session) {
      const data = await session.getMsgService().getMsgsIncludeSelf({ chatType: 2, guildId: '', peerUid: groupCode }, msgId, 1, false)
      return session.getGroupService().addGroupEssence({
        groupCode: groupCode,
        msgRandom: Number(data?.msgList[0].msgRandom),
        msgSeq: Number(data?.msgList[0].msgSeq)
      })
    } else {
      const ntMsgApi = this.ctx.get('ntMsgApi')!
      const data = await ntMsgApi.getMsgHistory({ chatType: 2, guildId: '', peerUid: groupCode }, msgId, 1, false)
      return await invoke('nodeIKernelGroupService/addGroupEssence', [{
        req: {
          groupCode: groupCode,
          msgRandom: Number(data?.msgList[0].msgRandom),
          msgSeq: Number(data?.msgList[0].msgSeq)
        }
      }])
    }
  }

  async createGroupFileFolder(groupId: string, folderName: string) {
    return await invoke('nodeIKernelRichMediaService/createGroupFolder', [{ groupId, folderName }])
  }

  async deleteGroupFileFolder(groupId: string, folderId: string) {
    return await invoke('nodeIKernelRichMediaService/deleteGroupFolder', [{ groupId, folderId }])
  }

  async deleteGroupFile(groupId: string, fileIdList: string[], busIdList: number[]) {
    return await invoke('nodeIKernelRichMediaService/deleteGroupFile', [{ groupId, busIdList, fileIdList }])
  }

  async getGroupFileList(groupId: string, fileListForm: GetFileListParam) {
    invoke('nodeIKernelMsgListener/onGroupFileInfoUpdate', [], { registerEvent: true })
    const data = await invoke<{ fileInfo: GroupFileInfo }>(
      'nodeIKernelRichMediaService/getGroupFileList',
      [{
        groupId,
        fileListForm
      }],
      {
        cbCmd: 'nodeIKernelMsgListener/onGroupFileInfoUpdate',
        afterFirstCmd: false,
        cmdCB: (payload, result) => payload.fileInfo.reqId === result
      }
    )
    return data.fileInfo
  }

  async publishGroupBulletin(groupCode: string, req: PublishGroupBulletinReq) {
    const ntUserApi = this.ctx.get('ntUserApi')!
    const psKey = (await ntUserApi.getPSkey(['qun.qq.com'])).domainPskeyMap.get('qun.qq.com')!
    return await invoke('nodeIKernelGroupService/publishGroupBulletin', [{ groupCode, psKey, req }])
  }

  async uploadGroupBulletinPic(groupCode: string, path: string) {
    const ntUserApi = this.ctx.get('ntUserApi')!
    const psKey = (await ntUserApi.getPSkey(['qun.qq.com'])).domainPskeyMap.get('qun.qq.com')!
    return await invoke('nodeIKernelGroupService/uploadGroupBulletinPic', [{ groupCode, psKey, path }])
  }

  async getGroupRecommendContact(groupCode: string) {
    const ret = await invoke('nodeIKernelGroupService/getGroupRecommendContactArkJson', [{ groupCode }])
    return ret.arkJson
  }

  async queryCachedEssenceMsg(groupCode: string, msgSeq = '0', msgRandom = '0') {
    return await invoke('nodeIKernelGroupService/queryCachedEssenceMsg', [{
      key: {
        groupCode,
        msgSeq: +msgSeq,
        msgRandom: +msgRandom
      }
    }])
  }

  async getGroupHonorList(groupCode: string) {
    // 还缺点东西
    return await invoke('nodeIKernelGroupService/getGroupHonorList', [{
      req: {
        groupCode: [+groupCode]
      }
    }])
  }

  async getGroupAllInfo(groupCode: string) {
    invoke('nodeIKernelGroupListener/onGroupAllInfoChange', [], {
      registerEvent: true
    })

    return await invoke<{ groupAll: GroupAllInfo }>(
      'nodeIKernelGroupService/getGroupAllInfo',
      [{
        groupCode,
        source: 4
      }],
      {
        cbCmd: 'nodeIKernelGroupListener/onGroupAllInfoChange',
        afterFirstCmd: false,
        cmdCB: payload => payload.groupAll.groupCode === groupCode
      }
    )
  }

  async getGroupBulletinList(groupCode: string) {
    invoke('nodeIKernelGroupListener/onGetGroupBulletinListResult', [], {
      registerEvent: true
    })

    const ntUserApi = this.ctx.get('ntUserApi')!
    const psKey = (await ntUserApi.getPSkey(['qun.qq.com'])).domainPskeyMap.get('qun.qq.com')!
    return await invoke<{
      groupCode: string
      context: string
      result: GroupBulletinListResult
    }>(
      'nodeIKernelGroupService/getGroupBulletinList',
      [{
        groupCode,
        psKey,
        context: '',
        req: {
          startIndex: -1,
          num: 20,
          needInstructionsForJoinGroup: 1,
          needPublisherInfo: 1
        }
      }],
      {
        cbCmd: 'nodeIKernelGroupListener/onGetGroupBulletinListResult',
        cmdCB: payload => payload.groupCode === groupCode,
        afterFirstCmd: false
      }
    )
  }

  async setGroupAvatar(groupCode: string, path: string) {
    return await invoke('nodeIKernelGroupService/setHeader', [{ path, groupCode }])
  }
}
