import {Record} from 'immutable'

import {REGEX_PGP_FINGERPRINT} from 'src/constants'
import {isObjectSame} from 'src/utils'

const AccountRecord = Record({  // eslint-disable-line new-cap
  // id: null,
  id_by_host: {},
  username: null,
  acct: null,
  display_name: null,
  locked: null,
  created_at: null,
  followers_count: null,
  following_count: null,
  statuses_count: null,
  note: null,
  url: null,
  avatar: null,
  avatar_static: null,
  header: null,
  header_static: null,
})


/**
 * OAuthでのApp登録を表すModel
 */
export default class Account extends AccountRecord {
  // static storeName = 'accounts'
  // static keyPath = 'address'
  // static indexes = [
  //   ['host', 'host', {}],
  // ]

  /**
   * @constructor
   */
  constructor(...args) {
    super(...args)
  }

  /**
   * @override
   */
  toJS() {
    const js = super.toJS()

    js.address = this.address
    return js
  }

  isEqual(other) {
    return this.acct === other.acct
  }

  /**
   * 一意な識別子を返す
   */
  get uri() {
    return this.url
  }

  get address() {
    console.warn('deprecated function')
    // acctは@を含んでないことが有る
    return this.account
  }

  get account() {
    console.warn('deprecated function')
    return this.acct
  }

  get id() {
    console.error('deprecated attribute')
    require('assert')(0)
  }

  getIdByHost(host) {
    return this.id_by_host[host]
  }

  get hasKeypair() {
    return this.hasPublicKey && this.hasPrivateKey
  }

  get hasPublicKey() {
    return this.note.match(REGEX_PGP_FINGERPRINT) ? true : false
  }

  get hasPrivateKey() {
    return this.privateKeyArmored ? true : false
  }

  get publicKeyId() {
    const match = this.note.match(REGEX_PGP_FINGERPRINT)
    if(!match)
      return null
    const fingerprint = match[1]
    if(fingerprint.length != 40)
      return null
    return fingerprint.substring(24)
  }

  get privateKeyArmored() {
    const keydata = localStorage.getItem(`pgp::privateKey::${this.acct}`)
    return keydata
  }

  get instance() {
    const t = this.acct.split('@', 2)
    if(t.length == 2)
      return t[1]
    return this.host
  }

  get safeAvatar() {
    return this.safeUrl(this.avatar)
  }

  safeUrl(url) {
    if(!url)
      return null
    if(url.startsWith('https://') || url.startsWith('http://'))
      return url
    if(!url.startsWith('/'))
      url = '/' + url
    return `https://${this.instance}${url}`
  }

  merge(newObj) {
    let changed = false
    const merged = super.mergeDeepWith((prev, next, key) => {
      if(typeof prev === 'object') {
        if(!isObjectSame(prev, next))
          changed = true
      }
      if(prev !== next) {
        changed = true
      }
      return next
    }, newObj)

    return {changed, merged}
  }
}

