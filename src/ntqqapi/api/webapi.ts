import { RequestUtil } from '@/common/utils/request'
import { Service, Context } from 'cordis'
import { Dict } from 'cosmokit'

declare module 'cordis' {
  interface Context {
    ntWebApi: NTQQWebApi
  }
}

export enum WebHonorType {
  ALL = 'all',
  TALKACTIVE = 'talkative',
  PERFROMER = 'performer',
  LEGEND = 'legend',
  STORONGE_NEWBI = 'strong_newbie',
  EMOTION = 'emotion'
}

export interface WebApiGroupMember {
  uin: number
  role: number
  g: number
  join_time: number
  last_speak_time: number
  lv: {
    point: number
    level: number
  }
  card: string
  tags: string
  flag: number
  nick: string
  qage: number
  rm: number
}

interface WebApiGroupMemberRet {
  ec: number
  errcode: number
  em: string
  cache: number
  adm_num: number
  levelname: any
  mems: WebApiGroupMember[]
  count: number
  svr_time: number
  max_count: number
  search_count: number
  extmode: number
}

interface GroupEssenceMsg {
  group_code: string
  msg_seq: number
  msg_random: number
  sender_uin: string
  sender_nick: string
  sender_time: number
  add_digest_uin: string
  add_digest_nick: string
  add_digest_time: number
  msg_content: any[]
  can_be_removed: true
}

export interface GroupEssenceMsgRet {
  retcode: number
  retmsg: string
  data: {
    msg_list: GroupEssenceMsg[]
    is_end: boolean
    group_role: number
    config_page_url: string
  }
}

interface SetGroupNoticeParams {
  groupCode: string
  content: string
  pinned: number
  type: number
  isShowEditCard: number
  tipWindowType: number
  confirmRequired: number
  picId: string
  imgWidth?: number
  imgHeight?: number
}

interface SetGroupNoticeRet {
  ec: number
  em: string
  id: number
  ltsm: number
  new_fid: string
  read_only: number
  role: number
  srv_code: number
}

export class NTQQWebApi extends Service {
  static inject = ['ntUserApi']

  constructor(protected ctx: Context) {
    super(ctx, 'ntWebApi', true)
  }

  async getGroupMembers(GroupCode: string, cached: boolean = true): Promise<WebApiGroupMember[]> {
    const memberData: Array<WebApiGroupMember> = new Array<WebApiGroupMember>()
    const cookieObject = await this.ctx.ntUserApi.getCookies('qun.qq.com')
    const cookieStr = this.cookieToString(cookieObject)
    const retList: Promise<WebApiGroupMemberRet>[] = []
    const params = new URLSearchParams({
      st: '0',
      end: '40',
      sort: '1',
      gc: GroupCode,
      bkn: this.genBkn(cookieObject.skey)
    })
    const fastRet = await RequestUtil.HttpGetJson<WebApiGroupMemberRet>(`https://qun.qq.com/cgi-bin/qun_mgr/search_group_members?${params}`, 'POST', '', { 'Cookie': cookieStr })
    if (!fastRet?.count || fastRet?.errcode !== 0 || !fastRet?.mems) {
      return []
    } else {
      for (const member of fastRet.mems) {
        memberData.push(member)
      }
    }
    const pageNum = Math.ceil(fastRet.count / 40)
    //遍历批量请求
    for (let i = 2; i <= pageNum; i++) {
      params.set('st', String((i - 1) * 40))
      params.set('end', String(i * 40))
      const ret = RequestUtil.HttpGetJson<WebApiGroupMemberRet>(`https://qun.qq.com/cgi-bin/qun_mgr/search_group_members?${params}`, 'POST', '', { 'Cookie': cookieStr })
      retList.push(ret)
    }
    //批量等待
    for (let i = 1; i <= pageNum; i++) {
      const ret = await (retList[i])
      if (!ret?.count || ret?.errcode !== 0 || !ret?.mems) {
        continue
      }
      for (const member of ret.mems) {
        memberData.push(member)
      }
    }
    return memberData
  }

  genBkn(sKey: string) {
    sKey = sKey || ''
    let hash = 5381
    for (let i = 0; i < sKey.length; i++) {
      const code = sKey.charCodeAt(i)
      hash = hash + (hash << 5) + code
    }
    return (hash & 0x7FFFFFFF).toString()
  }

  //实现未缓存 考虑2h缓存
  async getGroupHonorInfo(groupCode: string, getType: WebHonorType) {
    const getDataInternal = async (Internal_groupCode: string, Internal_type: number) => {
      let url = 'https://qun.qq.com/interactive/honorlist?gc=' + Internal_groupCode + '&type=' + Internal_type.toString()
      let res = ''
      let resJson
      try {
        res = await RequestUtil.HttpGetText(url, 'GET', '', { 'Cookie': cookieStr })
        const match = res.match(/window\.__INITIAL_STATE__=(.*?);/)
        if (match) {
          resJson = JSON.parse(match[1].trim())
        }
        if (Internal_type === 1) {
          return resJson?.talkativeList
        } else {
          return resJson?.actorList
        }
      } catch (e) {
        this.ctx.logger.error('获取当前群荣耀失败', url, e)
      }
      return undefined
    }

    let HonorInfo: any = { group_id: groupCode }
    const cookieObject = await this.ctx.ntUserApi.getCookies('qun.qq.com')
    const cookieStr = this.cookieToString(cookieObject)

    if (getType === WebHonorType.TALKACTIVE || getType === WebHonorType.ALL) {
      try {
        let RetInternal = await getDataInternal(groupCode, 1)
        if (!RetInternal) {
          throw new Error('获取龙王信息失败')
        }
        HonorInfo.current_talkative = {
          user_id: RetInternal[0]?.uin,
          avatar: RetInternal[0]?.avatar,
          nickname: RetInternal[0]?.name,
          day_count: 0,
          description: RetInternal[0]?.desc
        }
        HonorInfo.talkative_list = [];
        for (const talkative_ele of RetInternal) {
          HonorInfo.talkative_list.push({
            user_id: talkative_ele?.uin,
            avatar: talkative_ele?.avatar,
            description: talkative_ele?.desc,
            day_count: 0,
            nickname: talkative_ele?.name
          })
        }
      } catch (e) {
        this.ctx.logger.error(e)
      }
    }
    if (getType === WebHonorType.PERFROMER || getType === WebHonorType.ALL) {
      try {
        let RetInternal = await getDataInternal(groupCode, 2)
        if (!RetInternal) {
          throw new Error('获取群聊之火失败')
        }
        HonorInfo.performer_list = [];
        for (const performer_ele of RetInternal) {
          HonorInfo.performer_list.push({
            user_id: performer_ele?.uin,
            nickname: performer_ele?.name,
            avatar: performer_ele?.avatar,
            description: performer_ele?.desc
          })
        }
      } catch (e) {
        this.ctx.logger.error(e)
      }
    }
    if (getType === WebHonorType.PERFROMER || getType === WebHonorType.ALL) {
      try {
        let RetInternal = await getDataInternal(groupCode, 3)
        if (!RetInternal) {
          throw new Error('获取群聊炽焰失败')
        }
        HonorInfo.legend_list = []
        for (const legend_ele of RetInternal) {
          HonorInfo.legend_list.push({
            user_id: legend_ele?.uin,
            nickname: legend_ele?.name,
            avatar: legend_ele?.avatar,
            desc: legend_ele?.description
          })
        }
      } catch (e) {
        this.ctx.logger.error('获取群聊炽焰失败', e)
      }
    }
    if (getType === WebHonorType.EMOTION || getType === WebHonorType.ALL) {
      try {
        let RetInternal = await getDataInternal(groupCode, 6)
        if (!RetInternal) {
          throw new Error('获取快乐源泉失败')
        }
        HonorInfo.emotion_list = []
        for (const emotion_ele of RetInternal) {
          HonorInfo.emotion_list.push({
            user_id: emotion_ele?.uin,
            nickname: emotion_ele?.name,
            avatar: emotion_ele?.avatar,
            desc: emotion_ele?.description
          })
        }
      } catch (e) {
        this.ctx.logger.error('获取快乐源泉失败', e)
      }
    }
    //冒尖小春笋好像已经被tx扬了
    if (getType === WebHonorType.EMOTION || getType === WebHonorType.ALL) {
      HonorInfo.strong_newbie_list = []
    }
    return HonorInfo
  }

  async setGroupNotice(params: SetGroupNoticeParams): Promise<SetGroupNoticeRet> {
    const cookieObject = await this.ctx.ntUserApi.getCookies('qun.qq.com')
    const settings = JSON.stringify({
      is_show_edit_card: params.isShowEditCard,
      tip_window_type: params.tipWindowType,
      confirm_required: params.confirmRequired
    })

    return await RequestUtil.HttpGetJson<SetGroupNoticeRet>(
      `https://web.qun.qq.com/cgi-bin/announce/add_qun_notice?${new URLSearchParams({
        bkn: this.genBkn(cookieObject.skey),
        qid: params.groupCode,
        text: params.content,
        pinned: params.pinned.toString(),
        type: params.type.toString(),
        settings: settings,
        ...(params.picId !== '' && {
          pic: params.picId,
          imgWidth: params.imgWidth?.toString(),
          imgHeight: params.imgHeight?.toString(),
        })
      })}`,
      'POST',
      '',
      { 'Cookie': this.cookieToString(cookieObject) }
    )
  }

  private cookieToString(cookieObject: Dict) {
    return Object.entries(cookieObject).map(([key, value]) => `${key}=${value}`).join('; ')
  }
}
