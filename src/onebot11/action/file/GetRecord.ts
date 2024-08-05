import { GetFileBase, GetFilePayload, GetFileResponse } from './GetFile'
import { ActionName } from '../types'
import {decodeSilk} from "@/common/utils/audio";
import { getConfigUtil } from '@/common/config'
import path from 'node:path'
import fs from 'node:fs'

interface Payload extends GetFilePayload {
  out_format: 'mp3' | 'amr' | 'wma' | 'm4a' | 'spx' | 'ogg' | 'wav' | 'flac'
}

export default class GetRecord extends GetFileBase {
  actionName = ActionName.GetRecord

  protected async _handle(payload: Payload): Promise<GetFileResponse> {
    let res = await super._handle(payload)
    res.file = await decodeSilk(res.file!, payload.out_format)
    res.file_name = path.basename(res.file)
    res.file_size = fs.statSync(res.file).size.toString()
    if (getConfigUtil().getConfig().enableLocalFile2Url){
      res.base64 = fs.readFileSync(res.file, 'base64')
    }
    return res
  }
}
