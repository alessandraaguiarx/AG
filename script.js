// =======================================================
// CONFIGURAÇÃO DA GOOGLE SHEETS API
// =======================================================
const SPREADSHEET_ID = "COLE_AQUI_O_ID_DA_SUA_PLANILHA";
const API_KEY = "COLE_AQUI_SUA_CHAVE_API_DO_GOOGLE";

// Nomes exatos das abas dentro da sua planilha do Google Sheets
const ABA_PENDENCIAS = "Pendencias";
const ABA_MATERIAIS = "Materiais";

// (Opcional) URL do Google Apps Script para salvar novas solicitações direto na planilha
const APPS_SCRIPT_URL = "";

let listaPendencias = [];
let listaMateriais = [];

// =======================================================
// NAVEGAÇÃO ENTRE GUIAS
// =======================================================
function abrirGuia(nomeGuia, event) {
    if (event) event.preventDefault();

    // Esconde todas as seções
    document.querySelectorAll(".guia-secao").forEach(sec => sec.classList.remove("active"));
    // Mostra a seção escolhida
    document.getElementById(`guia-${nomeGuia}`).classList.add("active");

    // Atualiza estilo ativo nos botões e no menu superior
    document.querySelectorAll(".tab-btn, .nav-link").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(`[onclick*="'${nomeGuia}'"]`).forEach(el => el.classList.add("active"));
}

// =======================================================
// 1. CARREGAR PENDÊNCIAS DAS TORRES
// =======================================================
async function carregarPendencias() {
    const statusEl = document.getElementById("status-sync-pendencias");
    statusEl.textContent = "Atualizando pendências...";

    const url = `https://googleapis.com{SPREADSHEET_ID}/values/${ABA_PENDENCIAS}?key=${API_KEY}`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.values || data.values.length <= 1) {
            document.getElementById("corpo-pendencias").innerHTML =
                `<tr><td colspan="6" style="text-align:center;">Nenhuma pendência cadastrada na aba "${ABA_PENDENCIAS}".</td></tr>`;
            return;
        }

        // Atualiza cabeçalho conforme a linha 1 da planilha
        const cabecalho = data.values;
        const trCab = document.getElementById("cabecalho-pendencias");
        trCab.innerHTML = "";
        cabecalho.forEach(col => {
            const th = document.createElement("th");
            th.textContent = col;
            trCab.appendChild(th);
        });

        listaPendencias = data.values.slice(1);
        filtrarPendencias();

        statusEl.textContent = `Sincronizado às ${new Date().toLocaleTimeString("pt-BR")}`;
    } catch (err) {
        console.error(err);
        statusEl.textContent = "Erro ao carregar pendências. Verifique a API Key e o ID da planilha.";
    }
}

function filtrarPendencias() {
    const torre = document.getElementById("filtroTorre").value.toLowerCase();
    const disciplina = document.getElementById("filtroDisciplina").value.toLowerCase();
    const status = document.getElementById("filtroStatusPendencia").value.toLowerCase();
    const busca = document.getElementById("buscaPendencia").value.toLowerCase();

    const filtradas = listaPendencias.filter(linha => {
        const textoLinha = linha.join(" ").toLowerCase();
        const matchTorre = torre === "todas" || textoLinha.includes(torre);
        const matchDisc = disciplina === "todas" || textoLinha.includes(disciplina);
        const matchStatus = status === "todos" || textoLinha.includes(status);
        const matchBusca = textoLinha.includes(busca);
        return matchTorre && matchDisc && matchStatus && matchBusca;
    });

    renderizarTabelaGenerica(filtradas, "corpo-pendencias", 5);
}

// =======================================================
// 2. CARREGAR E REGISTRAR SOLICITAÇÕES DE MATERIAIS
// =======================================================
async function carregarMateriais() {
    const statusEl = document.getElementById("status-sync-materiais");
    statusEl.textContent = "Atualizando pedidos de materiais...";

    const url = `https://googleapis.com{SPREADSHEET_ID}/values/${ABA_MATERIAIS}?key=${API_KEY}`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.values || data.values.length <= 1) {
            document.getElementById("corpo-materiais").innerHTML =
                `<tr><td colspan="7" style="text-align:center;">Nenhuma solicitação na aba "${ABA_MATERIAIS}".</td></tr>`;
            return;
        }

        const cabecalho = data.values;
        const trCab = document.getElementById("cabecalho-materiais");
        trCab.innerHTML = "";
        cabecalho.forEach(col => {
            const th = document.createElement("th");
            th.textContent = col;
            trCab.appendChild(th);
        });

        listaMateriais = data.values.slice(1);
        renderizarTabelaGenerica(listaMateriais, "corpo-materiais", 6);

        statusEl.textContent = `Sincronizado às ${new Date().toLocaleTimeString("pt-BR")}`;
    } catch (err) {
        console.error(err);
        statusEl.textContent = "Erro ao carregar materiais.";
    }
}

async function enviarSolicitacaoMaterial(event) {
    event.preventDefault();
    const msgEl = document.getElementById("msg-envio-material");

    const novoPedido = {
        data: new Date().toLocaleDateString("pt-BR"),
        torre: document.getElementById("matTorre").value,
        disciplina: document.getElementById("matDisciplina").value,
        material: document.getElementById("matDescricao").value,
        quantidade: document.getElementById("matQuantidade").value,
        urgencia: document.getElementById("matUrgencia").value,
        solicitante: document.getElementById("matSolicitante").value,
        status: "Pendente"
    };

    // Adiciona visualmente na tabela imediatamente
    const novaLinha = [
        novoPedido.data,
        novoPedido.torre,
        novoPedido.disciplina,
        `${novoPedido.material} (${novoPedido.solicitante})`,
        novoPedido.quantidade,
        novoPedido.urgencia,
        novoPedido.status
    ];
    listaMateriais.unshift(novaLinha);
    renderizarTabelaGenerica(listaMateriais, "corpo-materiais", 6);

    // Se você configurar o Google Apps Script, envia automaticamente para a planilha
    if (APPS_SCRIPT_URL) {
        try {
            await fetch(APPS_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(novoPedido)
            });
            msgEl.textContent = "Solicitação salva diretamente na planilha do Google!";
        } catch (e) {
            msgEl.textContent = "Erro ao enviar para o servidor, mas registrado na tela.";
        }
    } else {
        msgEl.textContent = "Solicitação adicionada à visualização! (Conecte o Apps Script para salvar permanente na planilha).";
    }

    document.getElementById("formMaterial").reset();
}

// =======================================================
// RENDERIZADOR GENÉRICO DE TABELAS COM BADGES
// =======================================================
function renderizarTabelaGenerica(linhas, idCorpo, indiceColunaStatus) {
    const tbody = document.getElementById(idCorpo);
    tbody.innerHTML = "";

    if (linhas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Nenhum registro encontrado.</td></tr>`;
        return;
    }

    linhas.forEach(linha => {
        const tr = document.createElement("tr");

        linha.forEach((celula, idx) => {
            const td = document.createElement("td");
            const texto = celula || "-";

            if (idx === indiceColunaStatus || texto.toLowerCase() === "urgente") {
                const span = document.createElement("span");
                span.textContent = texto;
                span.classList.add("badge");

                const lower = texto.toLowerCase();
                if (lower.includes("conclu") || lower.includes("entregue")) span.classList.add("status-concluido");
                else if (lower.includes("andamento") || lower.includes("cotação")) span.classList.add("status-andamento");
                else if (lower.includes("urgente")) span.classList.add("status-urgente");
                else span.classList.add("status-pendente");

                td.appendChild(span);
            } else {
                td.textContent = texto;
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

// Inicialização automática e atualização a cada 60 segundos
carregarPendencias();
carregarMateriais();
setInterval(() => {
    carregarPendencias();
    carregarMateriais();
}, 60000);
