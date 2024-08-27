import fs from 'node:fs'
import fsPromise from 'node:fs/promises'
import path from 'node:path'
import { TEMP_DIR } from '../globalVars'
import { randomUUID, createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export function isGIF(path: string) {
  const buffer = Buffer.alloc(4)
  const fd = fs.openSync(path, 'r')
  fs.readSync(fd, buffer, 0, 4, 0)
  fs.closeSync(fd)
  return buffer.toString() === 'GIF8'
}

// 定义一个异步函数来检查文件是否存在
export function checkFileReceived(path: string, timeout: number = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()

    function check() {
      if (fs.existsSync(path)) {
        resolve()
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`文件不存在: ${path}`))
      } else {
        setTimeout(check, 200)
      }
    }

    check()
  })
}

export function calculateFileMD5(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // 创建一个流式读取器
    const stream = fs.createReadStream(filePath)
    const hash = createHash('md5')

    stream.on('data', (data: Buffer) => {
      // 当读取到数据时，更新哈希对象的状态
      hash.update(data)
    })

    stream.on('end', () => {
      // 文件读取完成，计算哈希
      const md5 = hash.digest('hex')
      resolve(md5)
    })

    stream.on('error', (err: Error) => {
      // 处理可能的读取错误
      reject(err)
    })
  })
}

export enum FileUriType {
  Unknown = 0,
  FileURL = 1,
  RemoteURL = 2,
  OneBotBase64 = 3,
  DataURL = 4,
  Path = 5
}

export function checkUriType(uri: string): { type: FileUriType } {
  if (uri.startsWith('base64://')) {
    return { type: FileUriType.OneBotBase64 }
  }
  if (uri.startsWith('data:')) {
    return { type: FileUriType.DataURL }
  }
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return { type: FileUriType.RemoteURL }
  }
  if (uri.startsWith('file://')) {
    return { type: FileUriType.FileURL }
  }
  try {
    if (fs.existsSync(uri)) return { type: FileUriType.Path }
  } catch { }
  return { type: FileUriType.Unknown }
}

interface FetchFileRes {
  data: Buffer
  url: string
}

export async function fetchFile(url: string, headersInit?: Record<string, string>): Promise<FetchFileRes> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Safari/537.36',
    'Host': new URL(url).hostname,
    ...headersInit
  }
  const raw = await fetch(url, { headers }).catch((err) => {
    if (err.cause) {
      throw err.cause
    }
    throw err
  })
  if (!raw.ok) throw new Error(`statusText: ${raw.statusText}`)
  return {
    data: Buffer.from(await raw.arrayBuffer()),
    url: raw.url
  }
}

type Uri2LocalRes = {
  success: boolean
  errMsg: string
  fileName: string
  path: string
  isLocal: boolean
}

export async function uri2local(uri: string, filename?: string): Promise<Uri2LocalRes> {
  const { type } = checkUriType(uri)

  if (type === FileUriType.FileURL) {
    const filePath = fileURLToPath(uri)
    const fileName = path.basename(filePath)
    return { success: true, errMsg: '', fileName, path: filePath, isLocal: true }
  }

  if (type === FileUriType.Path) {
    const fileName = path.basename(uri)
    return { success: true, errMsg: '', fileName, path: uri, isLocal: true }
  }

  if (type === FileUriType.RemoteURL) {
    try {
      const res = await fetchFile(uri)
      const match = res.url.match(/.+\/([^/?]*)(?=\?)?/)
      if (match?.[1]) {
        filename ??= match[1].replace(/[/\\:*?"<>|]/g, '_')
      } else {
        filename ??= randomUUID()
      }
      const filePath = path.join(TEMP_DIR, filename)
      await fsPromise.writeFile(filePath, res.data)
      return { success: true, errMsg: '', fileName: filename, path: filePath, isLocal: false }
    } catch (e: any) {
      const errMsg = `${uri}下载失败,` + e.toString()
      return { success: false, errMsg, fileName: '', path: '', isLocal: false }
    }
  }

  if (type === FileUriType.OneBotBase64) {
    filename ??= randomUUID()
    const filePath = path.join(TEMP_DIR, filename)
    const base64 = uri.replace(/^base64:\/\//, '')
    await fsPromise.writeFile(filePath, base64, 'base64')
    return { success: true, errMsg: '', fileName: filename, path: filePath, isLocal: false }
  }

  if (type === FileUriType.DataURL) {
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
    const capture = /^data:([\w/.+-]+);base64,(.*)$/.exec(uri)
    if (capture) {
      filename ??= randomUUID()
      const [, _type, base64] = capture
      const filePath = path.join(TEMP_DIR, filename)
      await fsPromise.writeFile(filePath, base64, 'base64')
      return { success: true, errMsg: '', fileName: filename, path: filePath, isLocal: false }
    }
  }

  return { success: false, errMsg: '未知文件类型', fileName: '', path: '', isLocal: false }
}

export async function copyFolder(sourcePath: string, destPath: string) {
  try {
    const entries = await fsPromise.readdir(sourcePath, { withFileTypes: true })
    await fsPromise.mkdir(destPath, { recursive: true })
    for (let entry of entries) {
      const srcPath = path.join(sourcePath, entry.name)
      const dstPath = path.join(destPath, entry.name)
      if (entry.isDirectory()) {
        await copyFolder(srcPath, dstPath)
      } else {
        try {
          await fsPromise.copyFile(srcPath, dstPath)
        } catch (error) {
          console.error(`无法复制文件 '${srcPath}' 到 '${dstPath}': ${error}`)
          // 这里可以决定是否要继续复制其他文件
        }
      }
    }
  } catch (error) {
    console.error('复制文件夹时出错:', error)
  }
}
