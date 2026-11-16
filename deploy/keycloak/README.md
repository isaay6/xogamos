# Cl@ve a través de Keycloak (exemplo probado)

Xogamos fala **OpenID Connect**. A pasarela Cl@ve fala **SAML 2.0**. Este directorio trae unha ponte
lista entre os dous con [Keycloak](https://www.keycloak.org/), software libre (Apache-2.0), e un
«Cl@ve simulado» para probar o percorrido enteiro nun portátil.

```
Xogamos ──OIDC (código + PKCE)──▶ Keycloak «xogamos» ──SAML 2.0──▶ Cl@ve (aquí, simulado)
```

**Isto é un laboratorio.** Non substitúe a alta administrativa en Cl@ve nin está certificado.
Serve para comprobar que a aplicación non necesita cambios o día que chegue a alta real.

## Probalo en 5 pasos

1. Arrinque Keycloak:

	```sh
	docker compose -f deploy/keycloak/compose.keycloak.yml up -d
	```

2. Arrinque Xogamos con estas variables:

	```sh
	IDENTITY_MODE=oidc
	PUBLIC_ORIGIN=http://localhost:3000
	OIDC_CLAVE_ISSUER=http://localhost:8081/realms/xogamos
	OIDC_CLAVE_CLIENT_ID=xogamos
	OIDC_SUBJECT_CLAIM=dni
	```

3. Abra `http://localhost:3000`, entre nun concello e prema **Entrar con Cl@ve**.
4. Na pantalla de Keycloak escolla **Cl@ve**. No Cl@ve simulado entre coa persoa ficticia
	`99999999r` e o contrasinal `demo-only`.
5. Volve a Xogamos coa sesión aberta. O identificador que recibe a aplicación é o DNI ficticio.

## Que hai en cada ficheiro

| Ficheiro | Que define |
|---|---|
| `realm-xogamos.json` | O cliente OIDC `xogamos` (público, PKCE S256 obrigatorio) e o provedor SAML `clave`, cos atributos de Cl@ve (`PersonIdentifier`, `FirstName`, `FamilyName`) levados ao DNI, nome e apelidos. O DNI sae no ID token como `dni`. |
| `realm-clave-simulado.json` | Un provedor SAML de proba cunha soa persoa ficticia. Emite os mesmos atributos que Cl@ve. |
| `compose.keycloak.yml` | Keycloak en modo de desenvolvemento, só en `127.0.0.1:8081`. |

## Pasar a Cl@ve real

1. **Alta.** O concello ou a Deputación solicita a alta como entidade usuaria de Cl@ve ante a
	Secretaría Xeral de Administración Dixital. Recibe os metadatos SAML e o acceso a preprodución.
2. **Keycloak en produción:** con HTTPS, base de datos propia e contrasinal de administración novo
	(non o modo `start-dev` deste exemplo).
3. **No provedor `clave` do reino `xogamos`** cambie:
	- `singleSignOnServiceUrl` e `idpEntityId`: os da pasarela Cl@ve;
	- `validateSignature`: `true`, co certificado da pasarela;
	- `wantAuthnRequestsSigned`: `true`, co certificado da entidade.
4. **No cliente `xogamos`:** as URI de retorno co dominio real.
5. **En Xogamos:** `OIDC_CLAVE_ISSUER` co enderezo público de Keycloak. Nada máis.
6. **Proba en preprodución** antes de abrir.

Para **Chave365**, a Xunta (AMTEGA) indica o protocolo na alta. Créase outro provedor en Keycloak e
configúranse as variables `OIDC_CHAVE365_...`. Se a Xunta ofrece OpenID Connect directamente, Xogamos
pode conectarse sen Keycloak.

## Sen Keycloak

Keycloak é opcional. Calquera provedor que cumpra OpenID Connect serve: Xogamos só necesita o
emisor, o identificador de cliente e, se o hai, o segredo.
