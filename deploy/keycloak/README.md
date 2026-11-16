# Proba local con Keycloak

Isto é só un laboratorio. A conta ficticia é `uxia.demo` e o contrasinal `demo-only`; non se debe reutilizar fóra da demostración.

1. Execute `docker compose -f deploy/keycloak/compose.keycloak.yml up`.
2. Configure `PUBLIC_ORIGIN=http://localhost:3000`, `IDENTITY_MODE=oidc`, `OIDC_CLAVE_ISSUER=http://localhost:8081/realms/xogamos` e `OIDC_CLAVE_CLIENT_ID=xogamos`.
3. Arrinque a aplicación en `localhost:3000`.
4. Abra unha pantalla de entrada e escolla Cl@ve.
5. En Keycloak entre coa persoa ficticia e comprobe a volta á aplicación.

## Alta real

Non hai certificación nin substituto da alta administrativa neste directorio. Para Cl@ve, a entidade debe darse de alta ante a AGE e recibir os metadatos SAML 2.0. En Keycloak, substitúa no broker SAML `clave` o `entityId`, a URL SSO, o certificado de sinatura e os metadatos polos entregados pola pasarela. Engada un mapper que leve o atributo DNI/NIE ao atributo OIDC configurado en `OIDC_SUBJECT_CLAIM` (por defecto `sub`), como texto estable de ata 64 caracteres.

Para Chave365 solicítese a alta á Xunta/AMTEGA e cree outro broker co protocolo, metadatos e certificados que se indiquen. Cree un cliente OIDC para a aplicación, con fluxo estándar, PKCE S256 e as dúas URI de retorno; configure o seu issuer, client ID e, se corresponde, segredo nas variables `OIDC_CHAVE365_*`. As altas e as probas de preprodución son responsabilidade da entidade operadora.
