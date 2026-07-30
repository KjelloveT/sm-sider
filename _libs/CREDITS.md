# Sjølv-hosta tredjepartsbibliotek

Alle bibliotek her blir lasta frå vår eigen tenar. Ingen av dei gjer kall ut
på nettet, og ingen brukardata forlèt nettlesaren fordi dei er i bruk.

Jf. `AGENTS.md` §5.6: nye avhengnader krev eksplisitt godkjenning frå
brukaren og skal sjølv-hostast her.

## lamejs 1.2.1 — `lamejs.min.js`

MP3-enkodar i rein JavaScript, brukt av **Lydskurd** til å lagre miksen som
mp3. Utan han kan vi berre skrive WAV, som blir fem–ti gonger så stort.

| | |
|---|---|
| Prosjekt | [lamejs](https://github.com/zhuker/lamejs) av Alex Zhukov |
| Bygd på | [LAME](https://lame.sourceforge.net/) |
| Lisens | LGPL-3.0 — sjå `lamejs-LICENSE.txt` |
| Versjon | 1.2.1 |
| Henta frå | npm-registeret (`npm pack lamejs`), 2026-07-30 |
| Storleik | 156 043 byte |
| SHA-256 | `15d285e2587b3bdbfd18a68de6ce07cc074f7480a82c3815da2dc1c348ec6df4` |
| Endra av oss | Nei — fila ligg slik ho kom frå pakka |

LGPL-vilkåra frå LAME er oppfylte slik: biblioteket ligg som ei sjølvstendig
fil som blir lenka inn, ikkje bakt inn i vår eigen kode; LAME er kreditert
her og i personvernoversikta; og vi har ikkje gjort endringar som må
leverast tilbake. Gjer vi endringar seinare, må dei publiserast under LGPL.

Godkjend av brukaren under planlegginga av Lydskurd.
