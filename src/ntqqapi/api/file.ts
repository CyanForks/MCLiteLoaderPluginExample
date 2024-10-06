import { invoke, NTClass, NTMethod } from '../ntcall'
import { GeneralCallResult } from '../services'
import {
  CacheFileList,
  CacheFileListItem,
  CacheFileType,
  CacheScanResult,
  ChatCacheListItemBasic,
  ChatType,
  ElementType,
  IMAGE_HTTP_HOST,
  IMAGE_HTTP_HOST_NT,
  PicElement,
} from '../types'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { ReceiveCmdS } from '../hook'
import { RkeyManager } from '@/ntqqapi/helper/rkey'
import { OnRichMediaDownloadCompleteParams, Peer } from '@/ntqqapi/types/msg'
import { calculateFileMD5 } from '@/common/utils/file'
import { copyFile, stat, unlink } from 'node:fs/promises'
import { Time } from 'cosmokit'
import { Service, Context } from 'cordis'

declare module 'cordis' {
  interface Context {
    ntFileApi: NTQQFileApi
    ntFileCacheApi: NTQQFileCacheApi
  }
}

export class NTQQFileApi extends Service {
  private rkeyManager: RkeyManager

  constructor(protected ctx: Context) {
    super(ctx, 'ntFileApi', true)
    this.rkeyManager = new RkeyManager(ctx, 'https://llob.linyuchen.net/rkey')
  }

  async getVideoUrl(peer: Peer, msgId: string, elementId: string): Promise<string | undefined> {
    const data = await invoke('nodeIKernelRichMediaService/getVideoPlayUrlV2', [{
      peer,
      msgId,
      elemId: elementId,
      videoCodecFormat: 0,
      params: {
        downSourceType: 1,
        triggerType: 1
      }
    }])
    if (data.result !== 0) {
      this.ctx.logger.warn('getVideoUrl', data)
    }
    return data.urlResult.domainUrl[0]?.url
  }

  async getFileType(filePath: string) {
    return await invoke<{
      ext: string
      mime: string
    }>(NTMethod.FILE_TYPE, [filePath], {
      className: NTClass.FS_API
    })
  }

  /** 上传文件到 QQ 的文件夹 */
  async uploadFile(filePath: string, elementType = ElementType.Pic, elementSubType = 0) {
    const fileMd5 = await calculateFileMD5(filePath)
    let fileName = path.basename(filePath)
    if (!fileName.includes('.')) {
      const ext = (await this.getFileType(filePath))?.ext
      fileName += ext ? '.' + ext : ''
    }
    const mediaPath = await invoke(NTMethod.MEDIA_FILE_PATH, [{
      path_info: {
        md5HexStr: fileMd5,
        fileName: fileName,
        elementType: elementType,
        elementSubType,
        thumbSize: 0,
        needCreate: true,
        downloadType: 1,
        file_uuid: '',
      },
    }])
    await copyFile(filePath, mediaPath)
    const fileSize = (await stat(filePath)).size
    return {
      md5: fileMd5,
      fileName,
      path: mediaPath,
      fileSize,
    }
  }

  async downloadMedia(
    msgId: string,
    chatType: ChatType,
    peerUid: string,
    elementId: string,
    thumbPath = '',
    sourcePath = '',
    timeout = 1000 * 60 * 2,
    force = false
  ) {
    // 用于下载收到的消息中的图片等
    if (sourcePath && existsSync(sourcePath)) {
      if (force) {
        try {
          await unlink(sourcePath)
        } catch { }
      } else {
        return sourcePath
      }
    }
    const data = await invoke<{ notifyInfo: OnRichMediaDownloadCompleteParams }>(
      'nodeIKernelMsgService/downloadRichMedia',
      [{
        getReq: {
          fileModelId: '0',
          downloadSourceType: 0,
          triggerType: 1,
          msgId: msgId,
          chatType: chatType,
          peerUid: peerUid,
          elementId: elementId,
          thumbSize: 0,
          downloadType: 1,
          filePath: thumbPath,
        },
      }],
      {
        cbCmd: ReceiveCmdS.MEDIA_DOWNLOAD_COMPLETE,
        cmdCB: payload => payload.notifyInfo.msgId === msgId,
        timeout
      }
    )
    return data.notifyInfo.filePath
  }

  async getImageSize(filePath: string) {
    return await invoke<{
      width: number
      height: number
      type: string
    }>(
      NTMethod.IMAGE_SIZE,
      [filePath],
      {
        className: NTClass.FS_API,
      }
    )
  }

  async getImageUrl(element: PicElement) {
    if (!element) {
      return ''
    }
    const url: string = element.originImageUrl!  // 没有域名
    const md5HexStr = element.md5HexStr
    const fileMd5 = element.md5HexStr

    if (url) {
      const parsedUrl = new URL(IMAGE_HTTP_HOST + url) //临时解析拼接
      const imageAppid = parsedUrl.searchParams.get('appid')
      const isNTPic = imageAppid && ['1406', '1407'].includes(imageAppid)
      if (isNTPic) {
        let rkey = parsedUrl.searchParams.get('rkey')
        if (rkey) {
          return IMAGE_HTTP_HOST_NT + url
        }
        const rkeyData = await this.rkeyManager.getRkey()
        rkey = imageAppid === '1406' ? rkeyData.private_rkey : rkeyData.group_rkey
        return IMAGE_HTTP_HOST_NT + url + rkey
      } else {
        // 老的图片url，不需要rkey
        return IMAGE_HTTP_HOST + url
      }
    } else if (fileMd5 || md5HexStr) {
      // 没有url，需要自己拼接
      return `${IMAGE_HTTP_HOST}/gchatpic_new/0/0-0-${(fileMd5 || md5HexStr)!.toUpperCase()}/0`
    }
    this.ctx.logger.error('图片url获取失败', element)
    return ''
  }

  async downloadFileForModelId(peer: Peer, fileModelId: string, timeout = 2 * Time.minute) {
    const data = await invoke<{ notifyInfo: OnRichMediaDownloadCompleteParams }>(
      'nodeIKernelRichMediaService/downloadFileForModelId',
      [{
        peer,
        fileModelIdList: [fileModelId],
        save_path: ''
      }],
      {
        cbCmd: ReceiveCmdS.MEDIA_DOWNLOAD_COMPLETE,
        cmdCB: payload => payload.notifyInfo.fileModelId === fileModelId,
        timeout,
        afterFirstCmd: false
      }
    )
    return data.notifyInfo.filePath
  }
}

export class NTQQFileCacheApi extends Service {
  constructor(protected ctx: Context) {
    super(ctx, 'ntFileCacheApi', true)
  }

  async setCacheSilentScan(isSilent: boolean = true) {
    return await invoke<GeneralCallResult>(NTMethod.CACHE_SET_SILENCE, [{ isSilent }])
  }

  getCacheSessionPathList() {
    return invoke<
      {
        key: string
        value: string
      }[]
    >(NTMethod.CACHE_PATH_SESSION, [], { className: NTClass.OS_API })
  }

  scanCache() {
    invoke<GeneralCallResult>(ReceiveCmdS.CACHE_SCAN_FINISH, [], { registerEvent: true })
    return invoke<CacheScanResult>(NTMethod.CACHE_SCAN, [], { timeout: 300 * Time.second })
  }

  getHotUpdateCachePath() {
    return invoke<string>(NTMethod.CACHE_PATH_HOT_UPDATE, [], { className: NTClass.HOTUPDATE_API })
  }

  getDesktopTmpPath() {
    return invoke<string>(NTMethod.CACHE_PATH_DESKTOP_TEMP, [], { className: NTClass.BUSINESS_API })
  }

  getFileCacheInfo(fileType: CacheFileType, pageSize: number = 1000, lastRecord?: CacheFileListItem) {
    const _lastRecord = lastRecord ? lastRecord : { fileType: fileType }

    return invoke<CacheFileList>(NTMethod.CACHE_FILE_GET, [{
      fileType: fileType,
      restart: true,
      pageSize: pageSize,
      order: 1,
      lastRecord: _lastRecord,
    }])
  }

  async clearChatCache(chats: ChatCacheListItemBasic[] = [], fileKeys: string[] = []) {
    return await invoke<GeneralCallResult>(NTMethod.CACHE_CHAT_CLEAR, [{
      chats,
      fileKeys,
    }])
  }
}
