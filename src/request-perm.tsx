import * as browser from 'webextension-polyfill'

import { render } from 'preact'
import { useState } from 'preact/hooks'

(async function () {
  function Page() {
    const [denied, setDenied] = useState(false)

    async function requestPerm() {
      setDenied(false)
      const contentScriptAllOrigins: browser.Permissions.Permissions = {
        permissions: [],
        origins: ['*://*/*'],
      }
      const gotPermission = await browser.permissions.request(contentScriptAllOrigins)
      if (gotPermission)
        window.close()
      else
        setDenied(true)
    }

    return (
      <>
        <h1>{browser.i18n.getMessage('req_perm_title')}</h1>
        <p>{browser.i18n.getMessage('req_perm_text')}</p>
        <button onClick={requestPerm}>{browser.i18n.getMessage('req_perm_btn')}</button>
        {denied ? <p className="denied">{browser.i18n.getMessage('req_perm_denied')}</p> : null}
      </>
    )
  }

  document.title = browser.i18n.getMessage('req_perm_title')
  render(<Page />, document.querySelector('main'),
  )
})()
