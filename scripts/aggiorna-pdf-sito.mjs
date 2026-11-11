import { spawnSync } from 'node:child_process';

function esegui(comando, argomenti) {
  console.log(`\nEsecuzione: ${comando} ${argomenti.join(' ')}`);

  const risultato = spawnSync(comando, argomenti, {
    stdio: 'inherit',
    shell: false
  });

  if (risultato.status !== 0) {
    throw new Error(`Comando fallito: ${comando}`);
  }
}

// Prima aggiorna l'elenco degli articoli.
esegui('npm', ['run', 'build']);

// Poi genera o aggiorna i PDF necessari.
esegui('node', ['scripts/genera-archivio-pdf.mjs']);

// Infine ricompila il sito con il manifest aggiornato.
esegui('npm', ['run', 'build']);

console.log('\nArchivio PDF aggiornato.');
