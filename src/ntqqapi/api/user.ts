import { User, UserDetailInfoByUin, UserDetailInfoByUinV2, UserDetailInfo, UserDetailSource, ProfileBizType, SimpleInfo } from '../types'
import { invoke } from '../ntcall'
import { getBuildVersion } from '@/common/utils'
import { getSession } from '@/ntqqapi/wrapper'
import { RequestUtil } from '@/common/utils/request'
import { isNullable, Time } from 'cosmokit'
import { Service, Context } from 'cordis'
import { selfInfo } from '@/common/globalVars'

declare module 'cordis' {
  interface Context {
    ntUserApi: NTQQUserApi
  }
}

export class NTQQUserApi extends Service {
  static inject = ['ntFriendApi', 'ntGroupApi']

  constructor(protected ctx: Context) {
    super(ctx, 'ntUserApi', true)
  }

  async setQQAvatar(path: string) {
    return await invoke(
      'nodeIKernelProfileService/setHeader',
      [
        { path },
        null,
      ],
      {
        timeout: 10 * Time.second, // 10秒不一定够
      }
    )
  }

  async fetchUserDetailInfo(uid: string) {
    const result = await invoke<{ info: UserDetailInfo }>(
      'nodeIKernelProfileService/fetchUserDetailInfo',
      [{
        callFrom: 'BuddyProfileStore',
        uid: [uid],
        source: UserDetailSource.KSERVER,
        bizList: [ProfileBizType.KALL]
      }],
      {
        cbCmd: 'nodeIKernelProfileListener/onUserDetailInfoChanged',
        afterFirstCmd: false,
        cmdCB: payload => payload.info.uid === uid,
      }
    )
    const { info } = result
    const ret: User = {
      ...info.simpleInfo.coreInfo,
      ...info.simpleInfo.status,
      ...info.simpleInfo.vasInfo,
      ...info.commonExt,
      ...info.simpleInfo.baseInfo,
      qqLevel: info.commonExt?.qqLevel,
      pendantId: ''
    }
    return ret
  }

  async getUserDetailInfo(uid: string) {
    if (getBuildVersion() >= 26702) {
      return this.fetchUserDetailInfo(uid)
    }
    const result = await invoke<{ info: User }>(
      'nodeIKernelProfileService/getUserDetailInfoWithBizInfo',
      [{
        uid,
        bizList: [0]
      }],
      {
        cbCmd: 'nodeIKernelProfileListener/onProfileDetailInfoChanged',
        afterFirstCmd: false,
        cmdCB: (payload) => payload.info.uid === uid,
      }
    )
    return result.info
  }

  async getCookies(domain: string) {
    const clientKeyData = await this.forceFetchClientKey()
    if (clientKeyData?.result !== 0) {
      throw new Error('获取clientKey失败')
    }
    const uin = selfInfo.uin
    const requestUrl = 'https://ssl.ptlogin2.qq.com/jump?ptlang=1033&clientuin=' + uin + '&clientkey=' + clientKeyData.clientKey + '&u1=https%3A%2F%2F' + domain + '%2F' + uin + '%2Finfocenter&keyindex=19%27'
    const cookies: { [key: string]: string } = await RequestUtil.HttpsGetCookies(requestUrl)
    return cookies
  }

  async getPSkey(domains: string[]) {
    return await invoke('nodeIKernelTipOffService/getPskey', [{ domains, isForNewPCQQ: true }, null])
  }

  async like(uid: string, count = 1) {
    const session = getSession()
    if (session) {
      return session.getProfileLikeService().setBuddyProfileLike({
        friendUid: uid,
        sourceId: 71,
        doLikeCount: count,
        doLikeTollCount: 0
      })
    } else {
      return await invoke(
        'nodeIKernelProfileLikeService/setBuddyProfileLike',
        [
          {
            doLikeUserInfo: {
              friendUid: uid,
              sourceId: 71,
              doLikeCount: count,
              doLikeTollCount: 0
            }
          },
          null,
        ],
      )
    }
  }

  async getUidByUinV1(uin: string) {
    let uid = (await invoke('nodeIKernelUixConvertService/getUid', [{ uins: [uin] }])).uidInfo.get(uin)
    if (!uid) {
      for (const membersList of this.ctx.ntGroupApi.groupMembers.values()) { //从群友列表转
        for (const member of membersList.values()) {
          if (member.uin === uin) {
            uid = member.uid
            break
          }
        }
        if (uid) break
      }
    }
    if (!uid) {
      const unveifyUid = (await this.getUserDetailInfoByUin(uin)).info.uid //特殊转换
      if (unveifyUid.indexOf('*') === -1) {
        uid = unveifyUid
      }
    }
    if (!uid) {
      const friends = await this.ctx.ntFriendApi.getFriends() //从好友列表转
      uid = friends.find(item => item.uin === uin)?.uid
    }
    return uid
  }

  async getUidByUinV2(uin: string, groupCode?: string) {
    let uid = (await invoke('nodeIKernelGroupService/getUidByUins', [{ uin: [uin] }])).uids.get(uin)
    if (uid) return uid
    uid = (await invoke('nodeIKernelProfileService/getUidByUin', [{ callFrom: 'FriendsServiceImpl', uin: [uin] }])).get(uin)
    if (uid) return uid
    uid = (await invoke('nodeIKernelUixConvertService/getUid', [{ uins: [uin] }])).uidInfo.get(uin)
    if (uid) return uid
    const unveifyUid = (await this.getUserDetailInfoByUinV2(uin)).detail.uid
    if (!unveifyUid.includes('*')) return unveifyUid
    if (groupCode) {
      const member = await this.ctx.ntGroupApi.getGroupMember(groupCode, uin)
      return member?.uid
    }
  }

  async getUidByUin(uin: string, groupCode?: string) {
    if (getBuildVersion() >= 26702) {
      return this.getUidByUinV2(uin, groupCode)
    }
    return this.getUidByUinV1(uin)
  }

  async getUserDetailInfoByUinV2(uin: string) {
    return await invoke<UserDetailInfoByUinV2>(
      'nodeIKernelProfileService/getUserDetailInfoByUin',
      [{ uin }]
    )
  }

  async getUserDetailInfoByUin(uin: string) {
    return await invoke<UserDetailInfoByUin>(
      'nodeIKernelProfileService/getUserDetailInfoByUin',
      [{ uin }]
    )
  }

  async getUinByUidV1(uid: string) {
    const ret = await invoke('nodeIKernelUixConvertService/getUin', [{ uids: [uid] }])
    let uin = ret.uinInfo.get(uid)
    if (!uin) {
      uin = (await this.getUserDetailInfo(uid)).uin
    }
    return uin
  }

  async getUinByUidV2(uid: string) {
    let uin = (await invoke('nodeIKernelGroupService/getUinByUids', [{ uid: [uid] }])).uins.get(uid)
    if (uin) return uin
    uin = (await invoke('nodeIKernelProfileService/getUinByUid', [{ callFrom: 'FriendsServiceImpl', uid: [uid] }])).get(uid)
    if (uin) return uin
    uin = (await invoke('nodeIKernelUixConvertService/getUin', [{ uids: [uid] }])).uinInfo.get(uid)
    if (uin) return uin
    uin = (await this.ctx.ntFriendApi.getBuddyIdMap(true)).get(uid)
    if (uin) return uin
    uin = (await this.getUserDetailInfo(uid)).uin
    return uin
  }

  async getUinByUid(uid: string) {
    if (getBuildVersion() >= 26702) {
      return this.getUinByUidV2(uid)
    }
    return this.getUinByUidV1(uid)
  }

  async forceFetchClientKey() {
    const session = getSession()
    if (session) {
      return await session.getTicketService().forceFetchClientKey('')
    } else {
      return await invoke('nodeIKernelTicketService/forceFetchClientKey', [{ url: '' }, null])
    }
  }

  async getSelfNick(refresh = true) {
    if ((refresh || !selfInfo.nick) && selfInfo.uid) {
      const { profiles } = await this.getUserSimpleInfo(selfInfo.uid)
      selfInfo.nick = profiles[selfInfo.uid].coreInfo.nick
    }
    return selfInfo.nick
  }

  async setSelfStatus(status: number, extStatus: number, batteryStatus: number) {
    return await invoke('nodeIKernelMsgService/setStatus', [{
      statusReq: {
        status,
        extStatus,
        batteryStatus,
      }
    }, null])
  }

  async getProfileLike(uid: string) {
    return await invoke('nodeIKernelProfileLikeService/getBuddyProfileLike', [{
      req: {
        friendUids: [uid],
        basic: 1,
        vote: 1,
        favorite: 0,
        userProfile: 1,
        type: 2,
        start: 0,
        limit: 20,
      }
    }, null])
  }

  async getUserSimpleInfo(uid: string, force = true) {
    return await invoke<{ profiles: Record<string, SimpleInfo> }>(
      'nodeIKernelProfileService/getUserSimpleInfo',
      [{
        uids: [uid],
        force
      }],
      {
        cbCmd: 'onProfileSimpleChanged',
        afterFirstCmd: false,
        cmdCB: payload => !isNullable(payload.profiles[uid]),
      }
    )
  }

  async getCoreAndBaseInfo(uids: string[]) {
    return await invoke(
      'nodeIKernelProfileService/getCoreAndBaseInfo',
      [{
        uids,
        callFrom: 'nodeStore'
      }]
    )
  }

  async getRobotUinRange() {
    const data = await invoke(
      'nodeIKernelRobotService/getRobotUinRange',
      [{
        req: {
          justFetchMsgConfig: '1',
          type: 1,
          version: 0,
          aioKeywordVersion: 0
        }
      }]
    )
    return data.response.robotUinRanges
  }
}
