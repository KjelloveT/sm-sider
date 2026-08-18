/* Bittelita module worker som berre seier frå at han starta.
 *
 * Finst for å skilje to heilt ulike feil frå kvarandre: at nettlesaren ikkje
 * støttar module workers i det heile, og at Pyodide-filene ikkje let seg
 * hente. Utan denne prøven ser dei to like ut frå utsida.
 */
self.postMessage('ok');
