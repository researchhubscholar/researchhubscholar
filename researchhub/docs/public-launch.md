# Public launch

Run `supabase/scholar_public.sql` once in the Scholar Supabase SQL Editor. No private API key or AI subscription is required. Without this migration, public pages render but Radar and contact submissions report temporary unavailability.

The public Radar allows three attempts per IP/network per UTC day. Failed upstream searches count as attempts. Normalized themes share a one-hour Next cache. The visitor hash is pseudonymous, not anonymous. The database stores no raw IP in the quota table; Vercel/Supabase may maintain infrastructure logs. Old quota rows are removed on a subsequent request after two days. This is basic traffic control, not strong abuse prevention: public RPCs and IP changes can bypass identity assumptions. For broad public acquisition, add Vercel WAF/bot protection and server-authenticated quota RPCs before relying on this as a cost/security boundary.

Contact records are private with no anonymous/authenticated table access. To review them as operator in the SQL Editor:

```sql
select id, name, email, purpose, message, created_at
from public.scholar_contact_requests order by created_at desc;
```

There are no notification emails or promises of immediate response. Monitor submissions and implement a verified operational support channel before a wider pilot. Contact storage currently has no automatic retention deadline; establish an operational retention/deletion policy.

The demo saves only a topic and timestamp locally on the register/login CTA. Dashboard offers explicit continuation within seven days; nothing is silently imported into the account. Projects and tools require login; literature API requests from guests return 401. Public demo uses the shared literature analysis with ten articles, while signed-in search retains twenty and its existing pagination.

Legal pages describe the testing phase. Before paid release publish the verified provider name, legal identity/CNPJ, address, official privacy/support channel, controller details, processing legal bases and retention periods, and reviewed annual payment/renewal/refund conditions. No fictitious business identity, subscription checkout, AI delivery or automatic renewal is represented as active.

Header source: https://vercel.com/docs/headers/request-headers
Privacy rights reference: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm

Validation: `node tests/public.cjs`, existing access/ideas/library suites, production build and public HTTP routes. Authenticated browser flows remain a manual pilot check.
