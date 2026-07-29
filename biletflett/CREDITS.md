# Tredjepartsressursar i BiletFlett

Alt ligg lokalt i prosjektet. BiletFlett gjer ingen kall til eksterne
tenarar, korkje ved lasting eller bruk.

## Skrifttypar — SIL Open Font License 1.1

Seks woff2-filer i `fonts/`, henta frå [Fontsource](https://fontsource.org/):
Baloo 2, Bebas Neue, Archivo Black, Fraunces og Nunito.
Full oversikt med opphavspersonar: [fonts/LICENSE.md](fonts/LICENSE.md).

## Fargesystem — Open Color (MIT)

`js/palette.js` inneheld fargeverdiane frå
[Open Color](https://yeun.github.io/open-color/) av Heeyeun Joo m.fl.
Berre verdiane er kopierte inn som data i vår eiga fil; ingen kode
frå prosjektet er brukt.

> MIT License — Copyright (c) 2016 heeyeun
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

## Bakgrunnsformer — eigen kode

`js/backdrops.js` inneheld **ingen importerte ressursar**. Formene er
rekna ut proseduralt fordi malane finst i tre format (portrett, landskap,
kvadrat), og fast path-data frå ein SVG-generator ville strekt seg feil
i to av dei.

Formspråket er henta frå det ein finn i [Haikei](https://haikei.app/) og
[Get Waves](https://getwaves.io/) — lagdelte bølgjer, mjuke klattar,
stabla toppar, konsentriske buer — men koden og geometrien er vår eigen.
Vil du lage varianter, er dei to nettstadene gode å hente idear frå.

## Figurar — Lucide (ISC)

Pynten i malane er teikna frå path-dataen i det felles ikonsettet
`../js/vyrdepil-icons.js`, som byggjer på [Lucide](https://lucide.dev/).
Lucide er alt husstandarden for ikon i Vyrdepil (sjå `AGENTS.md` §3.2).
