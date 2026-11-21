/**
 * LUAN HÉRCULES TATTOO STUDIO — Conexão Oficial Google Apps Script
 *
 * Como instalar na sua Planilha Google:
 * 1. Abra a planilha no Google Sheets e clique em: Extensões -> Apps Script.
 * 2. Apague o conteúdo padrão e cole todo este arquivo (Code.gs).
 * 3. Salve o projeto e execute a função "setupStudioWorkspace" (ou recarregue a planilha
 *    e use o menu "LUAN HÉRCULES STUDIO -> Configurar Pastas, Abas e Chave").
 * 4. Copie a chave gerada para a variável APPS_SCRIPT_SECRET no servidor (AI Studio / Vercel).
 * 5. Clique em: Implantar -> Nova implantação -> Tipo: App da Web
 *    - Executar como: Eu (seu e-mail Google)
 *    - Quem tem acesso: Qualquer pessoa (protegido pela chave APPS_SCRIPT_SECRET)
 * 6. Copie a URL "/exec" gerada para a variável APPS_SCRIPT_URL no servidor.
 */

var STUDIO_ROOT_FOLDER_NAME = 'LUAN HÉRCULES TATTOO';
var LEGACY_ROOT_FOLDER_NAME = 'LUAN HERCULES TATTOO';
var STUDIO_SPREADSHEET_NAME = 'LUAN HÉRCULES TATTOO — GERENCIAMENTO';

var STUDIO_SUBFOLDERS = {
  historia: 'HISTORIA',
  portfolio: 'PORTFOLIO',
  bastidores: 'BASTIDORES',
  identidadeVisual: 'IDENTIDADE-VISUAL',
  trilhaSonora: 'TRILHA-SONORA',
};

var STUDIO_SHEET_TABS = {
  GALERIA: [
    'ID',
    'Nome do arquivo',
    'ID Google Drive',
    'URL ou referência',
    'Legenda',
    'Descrição',
    'Categoria',
    'Ordem',
    'Publicado',
    'Data de inclusão',
  ],
  HISTORIA: ['ID', 'Título', 'Texto', 'ID da fotografia', 'Ordem', 'Publicado'],
  MUSICA: ['ID', 'Nome', 'ID Google Drive', 'Formato', 'Duração', 'Selecionada', 'Volume', 'Ativa'],
  AGENDAMENTOS: [
    'ID',
    'Nome',
    'WhatsApp',
    'E-mail',
    'Serviço',
    'Data pretendida',
    'Horário pretendido',
    'Descrição',
    'Status',
    'Data da solicitação',
  ],
  CONFIGURACOES: ['Chave', 'Valor', 'Atualizado em'],
  LOG: ['ID', 'Ação', 'Detalhes', 'Responsável', 'Data e hora'],
};

/**
 * Adiciona o menu administrativo diretamente dentro da planilha Google Sheets.
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('LUAN HÉRCULES STUDIO')
      .addItem('Configurar Pastas, Abas e Chave', 'setupStudioWorkspace')
      .addItem('Exibir Chave APPS_SCRIPT_SECRET', 'showCurrentSecretDialog')
      .addItem('Gerar Nova Chave Secreta', 'rotateAppsScriptSecret')
      .addToUi();
  } catch (err) {
    Logger.log('Menu disponível apenas quando vinculado a uma planilha: ' + err);
  }
}

/**
 * Executa a configuração inicial pela planilha ou editor do Apps Script.
 */
function setupStudioWorkspace() {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var secret = ensureSecret_();
    var foldersInfo = ensureStudioFolders_();
    var ss = getOrCreateStudioSpreadsheet_(foldersInfo.rootFolder);
    ensureTabsAndHeaders_(ss);

    var summary =
      'Estrutura configurada com sucesso!\n\n' +
      'Pasta principal: ' + STUDIO_ROOT_FOLDER_NAME + ' (' + foldersInfo.rootFolderId + ')\n' +
      'Planilha: ' + ss.getName() + ' (' + ss.getId() + ')\n' +
      'APPS_SCRIPT_SECRET: ' + secret + '\n\n' +
      'Guarde essa chave apenas nas variáveis de ambiente do servidor (AI Studio Secrets / Vercel).';

    Logger.log(summary);
    try {
      SpreadsheetApp.getUi().alert('LUAN HÉRCULES TATTOO STUDIO', summary, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (_) {
      // Executado fora da UI da planilha
    }

    return {
      ok: true,
      rootFolderId: foldersInfo.rootFolderId,
      folders: foldersInfo.folders,
      sheetId: ss.getId(),
      sheetUrl: ss.getUrl(),
    };
  } finally {
    lock.releaseLock();
  }
}

function showCurrentSecretDialog() {
  var secret = ensureSecret_();
  SpreadsheetApp.getUi().alert(
    'APPS_SCRIPT_SECRET',
    'Chave secreta atual configurada nas Script Properties:\n\n' +
      secret +
      '\n\nCadastre este valor em APPS_SCRIPT_SECRET no AI Studio Secrets e na Vercel.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function rotateAppsScriptSecret() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert(
    'Gerar nova chave secreta?',
    'A chave anterior deixará de ser aceita até você atualizar APPS_SCRIPT_SECRET no servidor.',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;
  var newSecret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  PropertiesService.getScriptProperties().setProperty('APPS_SCRIPT_SECRET', newSecret);
  showCurrentSecretDialog();
}

function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'LUAN HÉRCULES TATTOO STUDIO — Google Apps Script',
    status: 'online',
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_({ ok: false, error: 'Corpo da requisição ausente.' });
    }

    var body = JSON.parse(e.postData.contents);
    var expectedSecret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SECRET') || '';
    if (!expectedSecret || !constantTimeEquals_(String(body.secret || ''), expectedSecret)) {
      return jsonResponse_({ ok: false, error: 'Não autorizado: APPS_SCRIPT_SECRET inválido.' });
    }

    var action = String(body.action || 'ping');
    var foldersInfo = ensureStudioFolders_();
    var ss = getOrCreateStudioSpreadsheet_(foldersInfo.rootFolder);
    ensureTabsAndHeaders_(ss);

    if (action === 'ping' || action === 'ensureWorkspace') {
      return jsonResponse_({
        ok: true,
        email: resolveOwnerEmail_(),
        rootFolderId: foldersInfo.rootFolderId,
        folders: foldersInfo.folders,
        sheetId: ss.getId(),
        sheetUrl: ss.getUrl(),
      });
    }

    if (action === 'syncAll') {
      syncAllTabs_(ss, body.payload || {});
      return jsonResponse_({
        ok: true,
        email: resolveOwnerEmail_(),
        rootFolderId: foldersInfo.rootFolderId,
        folders: foldersInfo.folders,
        sheetId: ss.getId(),
        sheetUrl: ss.getUrl(),
      });
    }

    if (action === 'readAll') {
      return jsonResponse_({
        ok: true,
        email: resolveOwnerEmail_(),
        rootFolderId: foldersInfo.rootFolderId,
        folders: foldersInfo.folders,
        sheetId: ss.getId(),
        sheetUrl: ss.getUrl(),
        data: readAllTabs_(ss),
      });
    }

    if (action === 'upsertRow') {
      var upsertResult = upsertRow_(ss, String(body.tab || 'GALERIA'), body.values || []);
      return jsonResponse_({
        ok: true,
        mode: upsertResult.mode,
        rowNumber: upsertResult.rowNumber,
        sheetId: ss.getId(),
        sheetUrl: ss.getUrl(),
      });
    }

    if (action === 'readSheet') {
      var tab = String(body.tab || 'GALERIA');
      var targetSheet = ss.getSheetByName(tab) || ss.getSheets()[0];
      var lastRow = targetSheet.getLastRow();
      var lastCol = targetSheet.getLastColumn();
      var values = lastRow > 0 && lastCol > 0 ? targetSheet.getRange(1, 1, lastRow, lastCol).getValues() : [];
      var tabNames = ss.getSheets().map(function (s) { return s.getName(); });
      return jsonResponse_({
        ok: true,
        spreadsheetId: ss.getId(),
        title: ss.getName(),
        tabs: tabNames,
        activeTab: targetSheet.getName(),
        values: values,
      });
    }

    if (action === 'listFiles') {
      var targetFolderId = String(body.folderId || foldersInfo.rootFolderId);
      var folder = DriveApp.getFolderById(targetFolderId);
      var files = [];
      var iter = folder.getFiles();
      while (iter.hasNext() && files.length < 100) {
        var f = iter.next();
        if (!f.isTrashed()) {
          files.push({
            id: f.getId(),
            name: f.getName(),
            mimeType: f.getMimeType(),
            size: String(f.getSize()),
            modifiedTime: f.getLastUpdated().toISOString(),
            webViewLink: f.getUrl(),
          });
        }
      }
      return jsonResponse_({
        ok: true,
        rootFolderId: foldersInfo.rootFolderId,
        folders: foldersInfo.folders,
        currentFolderId: targetFolderId,
        files: files,
      });
    }

    if (action === 'uploadFile') {
      var folderKey = String(body.folderKey || 'portfolio');
      var destFolderId = foldersInfo.folders[folderKey] || foldersInfo.rootFolderId;
      var destFolder = DriveApp.getFolderById(destFolderId);
      var bytes = Utilities.base64Decode(String(body.base64Data || ''));
      var blob = Utilities.newBlob(bytes, String(body.mimeType || 'image/jpeg'), String(body.fileName || 'studio-asset'));
      var created = destFolder.createFile(blob);
      if (body.makePublic !== false) {
        created.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      }
      return jsonResponse_({
        ok: true,
        id: created.getId(),
        webViewLink: created.getUrl(),
      });
    }

    if (action === 'getFileBase64') {
      var readId = String(body.fileId || '');
      var fileObj = DriveApp.getFileById(readId);
      var fileBlob = fileObj.getBlob();
      return jsonResponse_({
        ok: true,
        mimeType: fileBlob.getContentType(),
        base64Data: Utilities.base64Encode(fileBlob.getBytes()),
      });
    }

    if (action === 'deleteFile') {
      var delId = String(body.fileId || '');
      if (delId && delId.indexOf('initial-') !== 0 && delId !== 'ambient-fallback') {
        try {
          DriveApp.getFileById(delId).setTrashed(true);
        } catch (_) {}
      }
      return jsonResponse_({ ok: true });
    }

    return jsonResponse_({ ok: false, error: 'Ação desconhecida: ' + action });
  } catch (err) {
    return jsonResponse_({
      ok: false,
      error: err && err.message ? err.message : String(err),
    });
  } finally {
    lock.releaseLock();
  }
}

function ensureSecret_() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('APPS_SCRIPT_SECRET');
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    props.setProperty('APPS_SCRIPT_SECRET', secret);
  }
  return secret;
}

function resolveOwnerEmail_() {
  try {
    return Session.getEffectiveUser().getEmail() || '';
  } catch (_) {
    return '';
  }
}

function ensureStudioFolders_() {
  var props = PropertiesService.getScriptProperties();
  var rootFolder = null;
  var savedRootId = props.getProperty('ROOT_FOLDER_ID');

  if (savedRootId) {
    try {
      var candidate = DriveApp.getFolderById(savedRootId);
      if (!candidate.isTrashed()) rootFolder = candidate;
    } catch (_) {}
  }

  if (!rootFolder) {
    rootFolder = findFolderByNames_([STUDIO_ROOT_FOLDER_NAME, LEGACY_ROOT_FOLDER_NAME], null);
  }
  if (!rootFolder) {
    rootFolder = DriveApp.createFolder(STUDIO_ROOT_FOLDER_NAME);
  }
  props.setProperty('ROOT_FOLDER_ID', rootFolder.getId());

  var folders = {};
  var keys = Object.keys(STUDIO_SUBFOLDERS);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var subName = STUDIO_SUBFOLDERS[key];
    var subId = props.getProperty('SUBFOLDER_' + key);
    var subFolder = null;

    if (subId) {
      try {
        var subCand = DriveApp.getFolderById(subId);
        if (!subCand.isTrashed()) subFolder = subCand;
      } catch (_) {}
    }
    if (!subFolder) {
      subFolder = findFolderByNames_([subName], rootFolder);
    }
    if (!subFolder) {
      subFolder = rootFolder.createFolder(subName);
    }
    props.setProperty('SUBFOLDER_' + key, subFolder.getId());
    folders[key] = subFolder.getId();
  }

  return {
    rootFolder: rootFolder,
    rootFolderId: rootFolder.getId(),
    folders: folders,
  };
}

function findFolderByNames_(names, parentFolder) {
  for (var i = 0; i < names.length; i++) {
    var iter = parentFolder ? parentFolder.getFoldersByName(names[i]) : DriveApp.getFoldersByName(names[i]);
    while (iter.hasNext()) {
      var f = iter.next();
      if (!f.isTrashed()) return f;
    }
  }
  return null;
}

function getOrCreateStudioSpreadsheet_(rootFolder) {
  var props = PropertiesService.getScriptProperties();
  var ss = null;

  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (_) {}

  if (!ss) {
    var savedSheetId = props.getProperty('SHEET_ID');
    if (savedSheetId) {
      try {
        ss = SpreadsheetApp.openById(savedSheetId);
      } catch (_) {}
    }
  }

  if (!ss) {
    var files = rootFolder.getFilesByName(STUDIO_SPREADSHEET_NAME);
    while (files.hasNext()) {
      var f = files.next();
      if (!f.isTrashed() && f.getMimeType() === MimeType.GOOGLE_SHEETS) {
        ss = SpreadsheetApp.openById(f.getId());
        break;
      }
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.create(STUDIO_SPREADSHEET_NAME);
  }

  // Garante que o arquivo da planilha fique organizado dentro da pasta LUAN HÉRCULES TATTOO
  try {
    var ssFile = DriveApp.getFileById(ss.getId());
    var parents = ssFile.getParents();
    var alreadyInRoot = false;
    while (parents.hasNext()) {
      if (parents.next().getId() === rootFolder.getId()) {
        alreadyInRoot = true;
        break;
      }
    }
    if (!alreadyInRoot) {
      ssFile.moveTo(rootFolder);
    }
  } catch (_) {}

  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function ensureTabsAndHeaders_(ss) {
  var tabNames = Object.keys(STUDIO_SHEET_TABS);
  for (var i = 0; i < tabNames.length; i++) {
    var tabName = tabNames[i];
    var headers = STUDIO_SHEET_TABS[tabName];
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  }
}

function syncAllTabs_(ss, payload) {
  var tabNames = Object.keys(STUDIO_SHEET_TABS);
  for (var i = 0; i < tabNames.length; i++) {
    var tabName = tabNames[i];
    var headers = STUDIO_SHEET_TABS[tabName];
    var rows = Array.isArray(payload[tabName]) ? payload[tabName] : [];
    var sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
    var allRows = [headers].concat(rows);
    sheet.clearContents();
    sheet.getRange(1, 1, allRows.length, headers.length).setValues(allRows);
    sheet.setFrozenRows(1);
  }
}

function readAllTabs_(ss) {
  var result = {};
  var tabNames = ['GALERIA', 'HISTORIA', 'MUSICA', 'AGENDAMENTOS', 'CONFIGURACOES'];
  for (var i = 0; i < tabNames.length; i++) {
    var name = tabNames[i];
    var sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) {
      result[name] = [];
      continue;
    }
    var lastRow = sheet.getLastRow();
    var lastCol = STUDIO_SHEET_TABS[name].length;
    result[name] = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  }
  return result;
}

function upsertRow_(ss, tabName, rowValues) {
  var headers = STUDIO_SHEET_TABS[tabName] || STUDIO_SHEET_TABS.GALERIA;
  var sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  var idVal = rowValues.length > 0 ? String(rowValues[0] || '').trim() : '';
  var lastRow = sheet.getLastRow();
  if (idVal && lastRow >= 2) {
    var colA = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < colA.length; i++) {
      if (String(colA[i][0] || '').trim() === idVal) {
        var targetRow = i + 2;
        sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
        return { mode: 'updated', rowNumber: targetRow };
      }
    }
  }
  sheet.appendRow(rowValues);
  return { mode: 'inserted', rowNumber: sheet.getLastRow() };
}

function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
