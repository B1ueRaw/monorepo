
const { entrypoints, storage } = require("uxp");

const HISTORY_MESSAGE = "sdppp:open-generation-history";
const HISTORY_ACTION_MESSAGE = "sdppp:generation-history-action";
const PROMPT_TEMPLATES_MESSAGE = "sdppp:open-prompt-templates";
const PROMPT_TEMPLATES_ACTION_MESSAGE = "sdppp:prompt-template-action";
let historyDialog = null;
let historyWebview = null;
let promptTemplatesDialog = null;
let promptTemplatesWebview = null;

function applyStyles(element, styles) {
    Object.assign(element.style, styles);
    return element;
}

function appendText(parent, tag, value, styles = {}) {
    const element = applyStyles(document.createElement(tag), styles);
    element.textContent = typeof value === "string" ? value : "";
    parent.appendChild(element);
    return element;
}

function appendHistoryIcon(parent, name) {
    const icons = {
        preview: "./icons/history-preview.png",
        delete: "./icons/history-delete.png",
        smartobject: "./icons/history-smartobject.png",
        newdoc: "./icons/history-newdoc.png",
        selection: "./icons/history-selection.png",
    };
    const icon = applyStyles(document.createElement("img"), {
        display: "block",
        width: "16px",
        height: "16px",
        pointerEvents: "none",
    });
    icon.src = icons[name] || "";
    icon.alt = "";
    parent.appendChild(icon);
}

function postHistoryAction(itemId, action) {
    const webview = historyWebview
        || document.getElementById("content-webview")
        || document.querySelector("webview");
    if (!webview || typeof webview.postMessage !== "function") {
        console.warn("Generation history webview is unavailable");
        return false;
    }
    try {
        webview.postMessage({ type: HISTORY_ACTION_MESSAGE, id: itemId, action }, "*");
        return true;
    } catch (error) {
        console.error("Failed to send generation history action", error);
        return false;
    }
}

function removeHistoryDialog() {
    if (!historyDialog) return;
    const dialog = historyDialog;
    historyDialog = null;
    try { dialog.close(); } catch (_) { }
    if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
}

function postPromptTemplateAction(itemId, action, item) {
    const webview = promptTemplatesWebview
        || document.getElementById("content-webview")
        || document.querySelector("webview");
    if (!webview || typeof webview.postMessage !== "function") return false;
    try {
        webview.postMessage({ type: PROMPT_TEMPLATES_ACTION_MESSAGE, id: itemId || "", action, item }, "*");
        return true;
    } catch (error) {
        console.error("Failed to send prompt template action", error);
        return false;
    }
}

function removePromptTemplatesDialog() {
    if (!promptTemplatesDialog) return;
    const dialog = promptTemplatesDialog;
    promptTemplatesDialog = null;
    try { dialog.close(); } catch (_) { }
    if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
}

function openPromptTemplatesDialog(message) {
    if (!message || !Array.isArray(message.items)) return;
    removePromptTemplatesDialog();

    let items = message.items.filter(item => item && typeof item === "object");
    const appliedIds = new Set(Array.isArray(message.appliedTemplateIds) ? message.appliedTemplateIds : []);
    const appendButton = (parent, text, styles = {}) => appendText(parent, "button", text, {
        padding: "7px 12px",
        color: "#fff",
        border: "1px solid rgba(255, 255, 255, 0.18)",
        borderRadius: "8px",
        backgroundColor: "rgba(80, 80, 80, 0.95)",
        cursor: "pointer",
        ...styles,
    });

    const dialog = applyStyles(document.createElement("dialog"), {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "0",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        color: "var(--uxp-host-text-color)",
        backgroundColor: "var(--uxp-host-background-color)",
    });
    const header = applyStyles(document.createElement("div"), {
        display: "flex",
        flex: "0 0 auto",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid var(--uxp-host-border-color)",
    });
    const title = appendText(header, "h2", message.title, { margin: "0", fontSize: "16px" });
    const headerActions = applyStyles(document.createElement("div"), {
        display: "flex",
        gap: "8px",
    });
    const addButton = appendButton(headerActions, message.addText, { backgroundColor: "#34773d" });
    const closeButton = appendButton(headerActions, message.closeText);
    header.appendChild(headerActions);
    dialog.appendChild(header);

    const content = applyStyles(document.createElement("div"), {
        display: "flex",
        alignContent: "flex-start",
        flexWrap: "wrap",
        gap: "12px",
        flex: "1",
        minHeight: "0",
        padding: "12px 16px",
        overflowY: "auto",
        boxSizing: "border-box",
    });
    const editor = applyStyles(document.createElement("div"), {
        display: "none",
        flexDirection: "column",
        gap: "10px",
        flex: "1",
        minHeight: "0",
        padding: "18px 24px",
        boxSizing: "border-box",
    });
    dialog.appendChild(content);
    dialog.appendChild(editor);

    const showGallery = () => {
        editor.style.display = "none";
        content.style.display = "flex";
        title.textContent = message.title;
        addButton.style.display = "block";
    };

    let deleteOverlay = null;
    const closeDeleteConfirm = () => {
        if (deleteOverlay && deleteOverlay.parentNode) deleteOverlay.parentNode.removeChild(deleteOverlay);
        deleteOverlay = null;
    };
    const showDeleteConfirm = item => {
        closeDeleteConfirm();
        const overlay = applyStyles(document.createElement("div"), {
            display: "flex",
            position: "absolute",
            top: "0",
            right: "0",
            bottom: "0",
            left: "0",
            zIndex: "20",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.62)",
        });
        const confirmDialog = applyStyles(document.createElement("div"), {
            width: "360px",
            padding: "22px",
            border: "1px solid var(--uxp-host-border-color)",
            borderRadius: "10px",
            backgroundColor: "var(--uxp-host-background-color)",
            boxSizing: "border-box",
        });
        appendText(confirmDialog, "h3", message.deleteText, { margin: "0 0 12px", fontSize: "16px" });
        appendText(confirmDialog, "p", message.deleteConfirmText, { margin: "0 0 20px", opacity: "0.82", fontSize: "13px" });
        const confirmActions = applyStyles(document.createElement("div"), {
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
        });
        const cancelDeleteButton = appendButton(confirmActions, message.cancelText);
        const confirmDeleteButton = appendButton(confirmActions, message.confirmText, { backgroundColor: "#d9363e" });
        confirmDialog.appendChild(confirmActions);
        overlay.appendChild(confirmDialog);
        dialog.appendChild(overlay);
        deleteOverlay = overlay;

        cancelDeleteButton.addEventListener("click", closeDeleteConfirm);
        confirmDeleteButton.addEventListener("click", () => {
            if (!postPromptTemplateAction(item.id, "delete")) return;
            items = items.filter(entry => entry.id !== item.id);
            appliedIds.delete(item.id);
            closeDeleteConfirm();
            renderCards();
        });
    };

    const renderCards = () => {
        content.textContent = "";
        if (!items.length) {
            appendText(content, "p", message.emptyText, { width: "100%", textAlign: "center", opacity: "0.7" });
            return;
        }

        items.forEach(item => {
            const applied = appliedIds.has(item.id);
            const card = applyStyles(document.createElement("div"), {
                display: "flex",
                position: "relative",
                flexDirection: "column",
                width: "calc(50% - 6px)",
                height: "210px",
                padding: "14px",
                overflow: "hidden",
                border: applied ? "2px solid #3f914a" : "1px solid var(--uxp-host-border-color)",
                borderRadius: "8px",
                boxSizing: "border-box",
            });
            appendText(card, "h3", item.name, {
                margin: "0 72px 10px 0",
                fontSize: "15px",
            });
            if (applied) appendText(card, "span", message.appliedText, {
                position: "absolute",
                top: "10px",
                right: "10px",
                padding: "3px 8px",
                color: "#fff",
                borderRadius: "10px",
                backgroundColor: "#34773d",
                fontSize: "11px",
            });
            appendText(card, "div", item.prompt, {
                flex: "1",
                overflow: "hidden",
                opacity: "0.82",
                fontSize: "13px",
                lineHeight: "1.55",
                whiteSpace: "pre-wrap",
            });

            const actions = applyStyles(document.createElement("div"), {
                display: "none",
                position: "absolute",
                right: "0",
                bottom: "0",
                left: "0",
                gap: "8px",
                padding: "10px",
                backgroundColor: "rgba(20, 20, 20, 0.9)",
            });
            const useButton = appendButton(actions, applied ? message.cancelText : message.useText, {
                flex: "1",
                backgroundColor: applied ? "rgba(80, 80, 80, 0.95)" : "#34773d",
            });
            useButton.addEventListener("click", event => {
                event.stopPropagation();
                if (!postPromptTemplateAction(item.id, "use")) return;
                if (applied) appliedIds.delete(item.id);
                else appliedIds.add(item.id);
                renderCards();
            });
            const editButton = appendButton(actions, message.editText);
            editButton.addEventListener("click", event => {
                event.stopPropagation();
                showEditor(item);
            });
            const deleteButton = appendButton(actions, message.deleteText, { backgroundColor: "#d9363e" });
            deleteButton.addEventListener("click", event => {
                event.stopPropagation();
                showDeleteConfirm(item);
            });
            card.appendChild(actions);
            card.addEventListener("mouseenter", () => { actions.style.display = "flex"; });
            card.addEventListener("mouseleave", () => { actions.style.display = "none"; });
            content.appendChild(card);
        });
    };

    const showEditor = item => {
        content.style.display = "none";
        editor.style.display = "flex";
        editor.textContent = "";
        title.textContent = item ? message.editText : message.addText;
        addButton.style.display = "none";

        const nameInput = applyStyles(document.createElement("sp-textfield"), { width: "100%" });
        const nameLabel = appendText(nameInput, "sp-label", message.nameText);
        nameLabel.setAttribute("slot", "label");
        editor.appendChild(nameInput);
        const nameValue = item ? String(item.name) : "";
        nameInput.setAttribute("value", nameValue);
        nameInput.value = nameValue;
        const promptInput = applyStyles(document.createElement("sp-textarea"), {
            width: "100%",
            minHeight: "180px",
            flex: "1",
        });
        const promptLabel = appendText(promptInput, "sp-label", message.promptText);
        promptLabel.setAttribute("slot", "label");
        editor.appendChild(promptInput);
        const promptValue = item ? String(item.prompt) : "";
        promptInput.setAttribute("value", promptValue);
        promptInput.value = promptValue;
        const errorText = appendText(editor, "div", "", { minHeight: "18px", color: "#ff5f62", fontSize: "12px" });
        const footer = applyStyles(document.createElement("div"), {
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "auto",
        });
        const cancelButton = appendButton(footer, message.cancelText);
        const saveButton = appendButton(footer, message.saveText, { backgroundColor: "#34773d" });
        editor.appendChild(footer);

        cancelButton.addEventListener("click", showGallery);
        saveButton.addEventListener("click", () => {
            const name = String(nameInput.value || "").trim();
            const prompt = String(promptInput.value || "").trim();
            if (!name) {
                errorText.textContent = message.missingNameText;
                return;
            }
            if (!prompt) {
                errorText.textContent = message.missingPromptText;
                return;
            }
            if (items.some(entry => entry.id !== (item && item.id) && String(entry.name).toLowerCase() === name.toLowerCase())) {
                errorText.textContent = message.duplicateNameText;
                return;
            }
            const saved = { id: item ? item.id : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name, prompt };
            if (!postPromptTemplateAction(saved.id, "save", saved)) return;
            items = item ? items.map(entry => entry.id === saved.id ? saved : entry) : [...items, saved];
            renderCards();
            showGallery();
        });
        nameInput.focus();
    };

    renderCards();
    document.body.appendChild(dialog);
    promptTemplatesDialog = dialog;

    addButton.addEventListener("click", () => showEditor(null));
    closeButton.addEventListener("click", removePromptTemplatesDialog);
    dialog.addEventListener("close", () => {
        if (promptTemplatesDialog === dialog) promptTemplatesDialog = null;
        if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
    });
    try {
        dialog.show({
            resize: "both",
            size: { width: 720, height: 640 },
            minSize: { width: 520, height: 360 },
        });
    } catch (error) {
        removePromptTemplatesDialog();
        console.error("Failed to open prompt templates window", error);
    }
}

function openHistoryDialog(message) {
    if (!message || !Array.isArray(message.items)) return;
    removeHistoryDialog();

    const dialog = applyStyles(document.createElement("dialog"), {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "0",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        color: "var(--uxp-host-text-color)",
        backgroundColor: "var(--uxp-host-background-color)",
    });
    const header = applyStyles(document.createElement("div"), {
        display: "flex",
        flex: "0 0 auto",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid var(--uxp-host-border-color)",
    });
    const headerStart = applyStyles(document.createElement("div"), {
        display: "flex",
        alignItems: "center",
        gap: "10px",
    });
    const backButton = appendText(headerStart, "button", message.backText, {
        display: "none",
        padding: "4px 10px",
    });
    const title = appendText(headerStart, "h2", message.title, { margin: "0", fontSize: "16px" });
    header.appendChild(headerStart);
    const closeButton = appendText(header, "button", message.closeText, { padding: "4px 12px" });
    dialog.appendChild(header);

    const content = applyStyles(document.createElement("div"), {
        flex: "1",
        minHeight: "0",
        padding: "12px 16px",
        overflowY: "auto",
        boxSizing: "border-box",
    });
    const detail = applyStyles(document.createElement("div"), {
        display: "none",
        flex: "1",
        minHeight: "0",
        padding: "16px 24px",
        overflowY: "auto",
        boxSizing: "border-box",
    });
    const items = message.items.filter(item => item && typeof item === "object");
    const galleryEntries = new Map();
    let visibleItemCount = items.length;
    if (!items.length) {
        appendText(content, "p", message.emptyText, { textAlign: "center", opacity: "0.7" });
    }

    const removeGalleryItem = id => {
        const entry = galleryEntries.get(id);
        if (!entry) return;
        if (entry.card.parentNode) entry.card.parentNode.removeChild(entry.card);
        galleryEntries.delete(id);
        visibleItemCount -= 1;
        if (entry.cards.children.length === 0 && entry.section.parentNode) {
            entry.section.parentNode.removeChild(entry.section);
        }
        if (visibleItemCount === 0) {
            appendText(content, "p", message.emptyText, { textAlign: "center", opacity: "0.7" });
        }
    };

    const showGallery = () => {
        detail.style.display = "none";
        content.style.display = "block";
        backButton.style.display = "none";
        title.textContent = message.title;
    };

    const showDetail = (item, imageSource) => {
        detail.textContent = "";
        content.style.display = "none";
        detail.style.display = "block";
        backButton.style.display = "block";
        detail.scrollTop = 0;

        if (imageSource && !/^javascript:/i.test(imageSource.trim())) {
            const imageRow = applyStyles(document.createElement("div"), {
                display: "flex",
                justifyContent: "center",
                marginBottom: "18px",
            });
            const imageFrame = applyStyles(document.createElement("div"), {
                display: "inline-block",
                position: "relative",
                maxWidth: "100%",
                overflow: "hidden",
                cursor: "zoom-in",
            });
            const image = applyStyles(document.createElement("img"), {
                display: "block",
                maxWidth: "100%",
                maxHeight: "460px",
                objectFit: "contain",
            });
            image.src = imageSource;
            image.alt = typeof message.imageAlt === "string" ? message.imageAlt : "";
            const hoverLayer = applyStyles(document.createElement("div"), {
                display: "none",
                position: "absolute",
                top: "0",
                right: "0",
                bottom: "0",
                left: "0",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0, 0, 0, 0.46)",
            });
            hoverLayer.appendChild(createActionBar(item, () => {
                removeGalleryItem(item.id);
                showGallery();
            }));
            const openPreview = () => {
                const preview = applyStyles(document.createElement("div"), {
                    display: "flex",
                    position: "absolute",
                    top: "0",
                    right: "0",
                    bottom: "0",
                    left: "0",
                    zIndex: "10",
                    padding: "16px",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0, 0, 0, 0.92)",
                    boxSizing: "border-box",
                    cursor: "zoom-out",
                });
                const previewImage = applyStyles(document.createElement("img"), {
                    display: "block",
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                });
                previewImage.src = imageSource;
                previewImage.alt = image.alt;
                preview.appendChild(previewImage);
                const closePreview = () => {
                    if (preview.parentNode) preview.parentNode.removeChild(preview);
                };
                preview.tabIndex = 0;
                preview.setAttribute("role", "button");
                preview.setAttribute("aria-label", message.closeText);
                preview.addEventListener("click", closePreview);
                preview.addEventListener("keydown", event => {
                    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") closePreview();
                });
                dialog.appendChild(preview);
                preview.focus();
            };
            imageFrame.tabIndex = 0;
            imageFrame.setAttribute("role", "button");
            imageFrame.setAttribute("aria-label", typeof message.previewText === "string" ? message.previewText : "");
            imageFrame.addEventListener("click", openPreview);
            imageFrame.addEventListener("keydown", event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                openPreview();
            });
            imageFrame.addEventListener("mouseenter", () => { hoverLayer.style.display = "flex"; });
            imageFrame.addEventListener("mouseleave", () => { hoverLayer.style.display = "none"; });
            imageFrame.appendChild(image);
            imageFrame.appendChild(hoverLayer);
            imageRow.appendChild(imageFrame);
            detail.appendChild(imageRow);
        }

        appendText(detail, "div", item.meta, {
            marginBottom: "10px",
            fontSize: "14px",
            lineHeight: "1.5",
            whiteSpace: "pre-wrap",
        });
        if (item.template) {
            appendText(detail, "div", item.template, { marginBottom: "18px", fontSize: "14px" });
        }

        const promptHeader = applyStyles(document.createElement("div"), {
            display: "flex",
            alignItems: "center",
            marginBottom: "8px",
        });
        appendText(promptHeader, "strong", message.positiveLabel, { fontSize: "15px" });
        const copyButton = appendText(promptHeader, "div", message.copyText, {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "24px",
            marginLeft: "8px",
            padding: "0 7px",
            border: "1px solid #34773d",
            borderRadius: "4px",
            color: "#fff",
            backgroundColor: "#34773d",
            boxSizing: "border-box",
            cursor: "pointer",
            fontSize: "12px",
        });
        copyButton.tabIndex = 0;
        copyButton.setAttribute("role", "button");
        copyButton.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText({
                    "text/plain": typeof item.prompt === "string" ? item.prompt : "",
                });
                copyButton.textContent = "✓";
                setTimeout(() => { copyButton.textContent = message.copyText; }, 1200);
            } catch (error) {
                console.error("Failed to copy generation prompt", error);
            }
        });
        copyButton.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            copyButton.click();
        });
        detail.appendChild(promptHeader);
        const promptText = applyStyles(document.createElement("textarea"), {
            width: "100%",
            height: "96px",
            marginBottom: item.negativePrompt ? "18px" : "0",
            padding: "10px 12px",
            border: "1px solid var(--uxp-host-border-color)",
            borderRadius: "6px",
            color: "var(--uxp-host-text-color)",
            backgroundColor: "rgba(0, 0, 0, 0.18)",
            boxSizing: "border-box",
            fontFamily: "inherit",
            fontSize: "14px",
            lineHeight: "1.6",
            resize: "vertical",
        });
        promptText.value = typeof item.prompt === "string" ? item.prompt : "";
        promptText.spellcheck = false;
        detail.appendChild(promptText);
        if (item.negativePrompt) {
            appendText(detail, "strong", message.negativeLabel, { display: "block", marginBottom: "6px", fontSize: "15px" });
            appendText(detail, "div", item.negativePrompt, { lineHeight: "1.6", whiteSpace: "pre-wrap", userSelect: "text" });
        }
    };

    const createActionBar = (item, onDelete) => {
        const bar = applyStyles(document.createElement("div"), {
            display: "flex",
            position: "absolute",
            left: "50%",
            bottom: "8px",
            width: "138px",
            justifyContent: "space-between",
            transform: "translateX(-50%)",
        });
        const labels = message.actionLabels && typeof message.actionLabels === "object"
            ? message.actionLabels
            : {};
        const tooltip = appendText(bar, "div", "", {
            display: "none",
            position: "absolute",
            right: "0",
            left: "0",
            bottom: "40px",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "28px",
            padding: "5px 8px",
            borderRadius: "4px",
            color: "#fff",
            backgroundColor: "rgba(0, 0, 0, 0.88)",
            boxSizing: "border-box",
            fontSize: "12px",
            textAlign: "center",
            whiteSpace: "nowrap",
            pointerEvents: "none",
        });
        ["delete", "smartobject", "newdoc", "selection"].forEach(action => {
            const danger = action === "delete";
            const disabled = action === "selection" && item.canSelect === false;
            const width = "30px";
            const button = applyStyles(document.createElement("div"), {
                display: "flex",
                position: "relative",
                alignItems: "center",
                justifyContent: "center",
                width,
                minWidth: width,
                maxWidth: width,
                height: "32px",
                minHeight: "32px",
                maxHeight: "32px",
                margin: "0",
                padding: "0",
                border: danger ? "1px solid rgba(255, 255, 255, 0.7)" : "1px solid #34773d",
                borderRadius: "6px",
                color: "#fff",
                backgroundColor: danger ? "rgba(20, 20, 20, 0.75)" : "#34773d",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.35)",
                boxSizing: "border-box",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? "0.4" : "1",
            });
            button.title = typeof labels[action] === "string" ? labels[action] : action;
            button.tabIndex = disabled ? -1 : 0;
            button.setAttribute("role", "button");
            button.setAttribute("aria-disabled", disabled ? "true" : "false");
            button.setAttribute("aria-label", button.title);
            appendHistoryIcon(button, action);
            button.addEventListener("mouseenter", () => {
                tooltip.textContent = button.title;
                tooltip.style.display = "flex";
            });
            button.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });
            const activate = event => {
                event.stopPropagation();
                if (disabled || !postHistoryAction(item.id, action)) return;
                if (danger) onDelete();
            };
            button.addEventListener("click", activate);
            button.addEventListener("keydown", event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                activate(event);
            });
            bar.appendChild(button);
        });
        return bar;
    };

    let currentDate = null;
    let dateSection = null;
    let cards = null;
    items.forEach(item => {
        if (item.dateLabel !== currentDate) {
            currentDate = item.dateLabel;
            dateSection = applyStyles(document.createElement("section"), { marginBottom: "16px" });
            appendText(dateSection, "div", item.dateLabel, {
                marginBottom: "8px",
                opacity: "0.65",
                fontSize: "12px",
            });
            cards = applyStyles(document.createElement("div"), {
                display: "flex",
                alignContent: "flex-start",
                flexWrap: "wrap",
            });
            dateSection.appendChild(cards);
            content.appendChild(dateSection);
        }

        const currentSection = dateSection;
        const currentCards = cards;
        const card = applyStyles(document.createElement("div"), {
            position: "relative",
            width: "154px",
            height: "154px",
            marginRight: "16px",
            marginBottom: "16px",
            overflow: "hidden",
            borderRadius: "5px",
            backgroundColor: "rgba(127, 127, 127, 0.14)",
            boxSizing: "border-box",
            cursor: "zoom-in",
        });
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", typeof message.previewText === "string" ? message.previewText : "");
        const imageSource = typeof item.image === "string" ? item.image : "";
        if (imageSource && !/^javascript:/i.test(imageSource.trim())) {
            const image = applyStyles(document.createElement("img"), {
                display: "block",
                position: "absolute",
                top: "50%",
                left: "50%",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "translate(-50%, -50%) scale(1)",
                transformOrigin: "center center",
                transition: "transform 160ms ease",
            });
            image.src = imageSource;
            image.alt = typeof message.imageAlt === "string" ? message.imageAlt : "";
            const hoverLayer = applyStyles(document.createElement("div"), {
                display: "none",
                position: "absolute",
                top: "0",
                right: "0",
                bottom: "0",
                left: "0",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                backgroundColor: "rgba(0, 0, 0, 0.46)",
            });
            hoverLayer.appendChild(createActionBar(item, () => removeGalleryItem(item.id)));
            card.addEventListener("mouseenter", () => {
                image.style.transform = "translate(-50%, -50%) scale(1.08)";
                hoverLayer.style.display = "flex";
            });
            card.addEventListener("mouseleave", () => {
                image.style.transform = "translate(-50%, -50%) scale(1)";
                hoverLayer.style.display = "none";
            });
            card.appendChild(image);
            card.appendChild(hoverLayer);
        } else {
            appendText(card, "span", message.imageAlt, { opacity: "0.6" });
        }
        const openDetail = () => showDetail(item, imageSource);
        card.addEventListener("click", openDetail);
        card.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            openDetail();
        });
        currentCards.appendChild(card);
        galleryEntries.set(item.id, { card, cards: currentCards, section: currentSection });
    });
    dialog.appendChild(content);
    dialog.appendChild(detail);
    document.body.appendChild(dialog);
    historyDialog = dialog;

    backButton.addEventListener("click", showGallery);
    closeButton.addEventListener("click", removeHistoryDialog);
    dialog.addEventListener("close", () => {
        if (historyDialog === dialog) historyDialog = null;
        if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
    });
    try {
        dialog.show({
            resize: "both",
            size: { width: 900, height: 820 },
            minSize: { width: 520, height: 360 },
        });
    } catch (error) {
        removeHistoryDialog();
        console.error("Failed to open generation history window", error);
    }
}

window.addEventListener("message", event => {
    if (event.data?.type === HISTORY_MESSAGE) {
        historyWebview = event.source;
        openHistoryDialog(event.data);
    } else if (event.data?.type === PROMPT_TEMPLATES_MESSAGE) {
        promptTemplatesWebview = event.source;
        openPromptTemplatesDialog(event.data);
    }
});

const _id = Symbol("_id");
const _root = Symbol("_root");
const _attachment = Symbol("_attachment");
const _menuItems = Symbol("_menuItems");

class PanelController {
    constructor({ id, menuItems } = {}) {
        this[_id] = null;
        this[_root] = null;
        this[_attachment] = null;
        this[_menuItems] = [];

        this[_id] = id;
        this[_menuItems] = menuItems || [];
        this.menuItems = this[_menuItems].map(menuItem => ({
            id: menuItem.id,
            label: menuItem.label,
            enabled: menuItem.enabled || true,
            checked: menuItem.checked || false
        }));

        ["create", "show", "hide", "destroy", "invokeMenu"].forEach(fn => this[fn] = this[fn].bind(this));
    }

    create() {
        this[_root] = document.getElementById("root");
        // this[_root].style.height = "100vh";
        this[_root].style.overflowY = "hidden";
        this[_root].style.overflowX = "hidden";

        // render entry
        // 渲染入口
        globalThis.sdpppX.__start__(this[_root]);

        return this[_root];
    }

    show(event) {
        if (!this[_root]) this.create();
        this[_attachment] = event;
    }

    hide() {
        if (this[_attachment] && this[_root]) {
            this[_attachment].removeChild(this[_root]);
            this[_attachment] = null;
        }
    }

    destroy() { }

    invokeMenu(id) {
        const menuItem = this[_menuItems].find(c => c.id === id);
        if (menuItem) {
            const handler = menuItem.oninvoke;
            if (handler) {
                handler();
            }
        }
    }
}

entrypoints.setup({
    plugin: {
        create(plugin) {
        },
        destroy() {
        }
    },
    panels: {
        'sd-ppp': new PanelController({
            id: "sd-ppp", menuItems: [
                {
                    id: "sd-ppp-log",
                    label: "查看日志",
                    enabled: true,
                    checked: false,
                    oninvoke: async () => {
                        const logContent = globalThis.sdpppX.__getLogs__().join('\n');
                        
                        // 同时将日志写入文件
                        try {
                            const localFileSystem = storage.localFileSystem;
                            
                            // 获取插件数据文件夹
                            const pluginDataFolder = await localFileSystem.getTemporaryFolder();
                            
                            // 创建日志文件名（带时间戳）
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                            const logFileName = `sdppp-log-${timestamp}.txt`;
                            
                            // 创建或获取日志文件
                            const logFile = await pluginDataFolder.createFile(`${logFileName}`, { type: "file", overwrite: true});
                            
                            alert(`日志已保存到文件: ${logFile.nativePath}\n\n\n`);

                            // 写入日志内容
                            await logFile.write(logContent, {append: false});
                        } catch (error) {
                            console.error('写入日志文件失败:', error);
                        }
                    }
                }
            ]
        }),
    }
});
