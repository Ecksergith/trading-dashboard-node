# Ukulo Trade - Instalador

## Ukulo Digital Comercio e Prestacao de Servicos, LDA
### NIF: 5002885131

---

## Opcoes de Instalacao

### Opcao 1: Instalador Inno Setup (Recomendado)

1. Instale o [Inno Setup 6](https://jrsoftware.org/isinfo.php)
2. Execute `build.bat` na pasta `installer/`
3. O instalador sera gerado em `installer/output/`
4. Execute o arquivo `UkuloTrade_Setup_1.0.0.exe`

**Vantagens:**
- Assistente de instalacao profissional
- Suporte a desinstalacao
- Opcoes de instalacao configuraveis
- Suporte a atualizacoes

### Opcao 2: Instalador Simples (Batch)

1. Execute `install.bat` na pasta `installer/`
2. Siga as instrucoes na tela

**Vantagens:**
- Nao requer instalacao adicional
- Instalacao rapida e simples

---

## Requisitos

- **Node.js** 18.0.0 ou superior
- **MetaTrader 5** (para operacoes de trading)
- **MT5 Bridge** (para integracao com MT5)

---

## Estrutura de Arquivos

```
installer/
├── setup.iss          # Script Inno Setup
├── terms.txt          # Termos e Condicoes de Uso
├── build.bat          # Script para construir instalador Inno Setup
├── install.bat        # Instalador simples (Batch)
├── uninstall.bat      # Desinstalador (Batch)
└── output/            # Diretorio de saida do instalador
```

---

## Termos e Condicoes

O arquivo `terms.txt` contem os Termos e Condicoes de Uso do Ukulo Trade, incluindo:

- Descricao do Software
- Limitacao de Responsabilidade
- Aviso de Risco
- Propriedade Intelectual
- Privacidade e Protecao de Dados

---

## Informacoes da Empresa

**Ukulo Digital Comercio e Prestacao de Servicos, LDA**
- NIF: 5002885131
- Email: suporte@ukulodigital.co.ao
- Website: https://ukulodigital.co.ao

---

## Suporte

Para suporte tecnico, entre em contato:
- Email: suporte@ukulodigital.co.ao
- Website: https://ukulodigital.co.ao

---

## Notas Importantes

1. **Aviso de Risco**: Operacoes de trading envolvem riscos significativos. O Ukulo Trade e uma ferramenta de apoio a decisao e nao constitui aconselhamento financeiro.

2. **Backup**: Antes de atualizar ou desinstalar, faça backup dos seus dados de configuracao.

3. **MT5 Bridge**: Para usar o Ukulo Trade com MetaTrader 5, e necessario ter o MT5 Bridge configurado e em execucao.

---

**Todos os direitos reservados.**
Ukulo Digital Comercio e Prestacao de Servicos, LDA
