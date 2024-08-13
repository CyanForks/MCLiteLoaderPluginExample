import BaseAction from '../BaseAction'
import { ActionName } from '../types'
import fs from 'fs'
import fsPromise from 'fs/promises'
import path from 'node:path'
import { calculateFileMD5, httpDownload, TEMP_DIR } from '@/common/utils'
import { randomUUID } from 'node:crypto'

interface Payload {
  thread_count?: number
  url?: string
  base64?: string
  name?: string
  headers?: string | string[]
}

interface FileResponse {
  file: string
}

export default class GoCQHTTPDownloadFile extends BaseAction<Payload, FileResponse> {
  actionName = ActionName.GoCQHTTP_DownloadFile

  protected async _handle(payload: Payload): Promise<FileResponse> {
    const isRandomName = !payload.name
    const name = payload.name ? path.basename(payload.name) : randomUUID()
    const filePath = path.join(TEMP_DIR, name)

    if (payload.base64) {
      await fsPromise.writeFile(filePath, payload.base64, 'base64')
    } else if (payload.url) {
      const headers = this.getHeaders(payload.headers)
      const buffer = await httpDownload({ url: payload.url, headers: headers })
      await fsPromise.writeFile(filePath, buffer)
    } else {
      throw new Error('不存在任何文件, 无法下载')
    }
    if (fs.existsSync(filePath)) {
      if (isRandomName) {
        // 默认实现要名称未填写时文件名为文件 md5
        const md5 = await calculateFileMD5(filePath)
        const newPath = path.join(TEMP_DIR, md5)
        await fsPromise.rename(filePath, newPath)
        return { file: newPath }
      }
      return { file: filePath }
    } else {
      throw new Error('文件写入失败, 检查权限')
    }
  }

  getHeaders(headersIn?: string | string[]): Record<string, string> {
    const headers = {}
    if (typeof headersIn == 'string') {
      headersIn = headersIn.split('[\\r\\n]')
    }
    if (Array.isArray(headersIn)) {
      for (const headerItem of headersIn) {
        const spilt = headerItem.indexOf('=')
        if (spilt < 0) {
          headers[headerItem] = ''
        } else {
          const key = headerItem.substring(0, spilt)
          headers[key] = headerItem.substring(0, spilt + 1)
        }
      }
    }
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/octet-stream'
    }
    return headers
  }
}
