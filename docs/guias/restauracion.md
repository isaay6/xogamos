# Restaurar unha copia

**Para quen:** o servizo de informática.
**Cando:** perda de datos, erro grave tras unha actualización ou cambio de servidor.
**Tempo:** 15 minutos.

## Antes de empezar

- As copias diarias están en `backups/`, co nome `reservas-AAAAMMDD-HHMM.dump`.
- Restaurar **substitúe todos os datos actuais**. O que se reservou despois da copia pérdese.
- O script fai antes unha copia de seguridade do estado actual, por se hai que volver.

## Pasos

1. Escolla a copia:

	```sh
	ls -lh backups/
	```

2. Restaure:

	```sh
	./scripts/restore.sh backups/reservas-20261117-0300.dump
	```

	O script comproba a copia, pide confirmación, para a aplicación, restaura e volve arrincala.

3. Comprobe que responde: `https://o-seu-dominio/healthz` debe dar `{"ok":true}`.
4. Entre como administración e mire a axenda de hoxe.
5. Avise aos concellos de que hora é a copia, para que repitan as reservas posteriores.

## Cambiar de servidor

1. No servidor novo, instale ([despregar](despregamento-deputacion.md), paso 1).
2. Copie o `.env` do servidor vello. **O `AUTH_SECRET` debe ser o mesmo:** con el calcúlanse os QR
	das reservas e a busca por DNI.
3. Copie a última copia a `backups/` e restaure (paso 2 de arriba).
4. Cambie o DNS ao servidor novo.

## Proba periódica

Unha copia que nunca se restaurou non é unha copia. O proxecto proba a restauración completa en
cada cambio do código (`scripts/test-restore.sh`, na integración continua). Na súa instalación,
fágao cada trimestre nunha máquina á parte.
