/** @jsx jsx */
import { Hono } from 'https://deno.land/x/hono/mod.ts'
import { logger, jsx } from 'https://deno.land/x/hono/middleware.ts'
import { kvClient } from 'npm:hono-kv-session/bun';
import { SessionManager, createSession, deleteSession, renewSession, regenerateSession } from 'npm:hono-kv-session';

const app = new Hono()

app.use('*', kvClient());
app.use('*', logger())

app.use('*', SessionManager({
  ttl: 60,
  renew: true,
  // regenerate: true,
}))

app.get('/', async (c) => {
  const { value: user } = c.session

  const keys = await c.kv.keys('*');

  const kvLists = await Promise.all(
    keys.map(async (name) => {
      const [ expiration, value ] = await c.kv.multi().ttl(name).get(name).exec()

      const now = Date.now()
      const date = new Date(now + (expiration * 1000)).toISOString()

      return [ name, value, date, expiration ]
    })
  )

  return c.html(
    <div>
      <h1>hono-kv-session Demo</h1>
      <ul>
        <li>Source Code: <a href="https://github.com/shinosaki/hono-kv-session">Github</a></li>
        <li>Author: <a href="https://shinosaki.com">@shinosaki</a></li>
      </ul>
      <form method="POST">
        <input name="user" placeholder="username" />
        <button>Get Session</button>
        <p>{(user) ? `User: ${user}` : 'Session not found'}</p>
        <hr />
        <h2>KV DATA</h2>
        <table>
          <thead>
            <tr>
              <th>KV Key</th>
              <td>KV Value</td>
              <td>Expiration Date (after n sec)</td>
            </tr>
          </thead>
          <tbody>
            {kvLists.map(([ key, data, expire, diff ]) => 
              <tr>
                <th>{key}</th>
                <td>{data}</td>
                <td>{expire} ({diff})</td>
              </tr>
            )}
          </tbody>
        </table>
      </form>
      <hr />
      <form action="/delete" method="POST">
        <button>Delete Session</button>
      </form>
      <form action="/renew" method="POST">
        <button>Renew Session</button>
      </form>
      <form action="/regen" method="POST">
        <button>Regenerate Session</button>
      </form>
    </div>
  )
})

app.post('/', async (c) => {
  const { user } = await c.req.parseBody()
  await createSession(c, user)
  return c.redirect('/')
})

app.post('/delete', async (c) => {
  await deleteSession(c)
  return c.redirect('/')
})

app.post('/renew', async (c) => {
  await renewSession(c)
  return c.redirect('/')
})

app.post('/regen', async (c) => {
  await regenerateSession(c)
  return c.redirect('/')
})

Deno.serve(app.fetch)
