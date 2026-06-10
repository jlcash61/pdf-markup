/* **************************************************
   PDF MARKUP TOOL

   This file is intentionally organized in large
   sections so each part of the app can be learned,
   changed, and eventually moved into modules.

   Current milestone:
   - Load and render a PDF or blank page
   - Navigate pages
   - Zoom / fit the page
   - Draw, select, move, resize, and delete rectangles/text boxes/callouts
   - Edit shape stroke, fill, opacity, line width, and text
   - Save/open project files and export flattened PDFs
   ************************************************** */

/* **************************************************
   DOM REFERENCES

   These constants are the connection points between
   JavaScript and the elements in index.html.
   ************************************************** */

const openBtn = document.getElementById("openPdfBtn");
const newBlankBtn = document.getElementById("newBlankBtn");
const fileInput = document.getElementById("pdfFileInput");
const openProjectBtn = document.getElementById("openProjectBtn");
const projectFileInput = document.getElementById("projectFileInput");
const saveProjectBtn = document.getElementById("saveProjectBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const documentTitleInput = document.getElementById("documentTitleInput");
const statusBar = document.getElementById("statusBar");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageDisplay = document.getElementById("pageDisplay");

const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomDisplay = document.getElementById("zoomDisplay");
const fitPageBtn = document.getElementById("fitPageBtn");
const fitWidthBtn = document.getElementById("fitWidthBtn");
const actualSizeBtn = document.getElementById("actualSizeBtn");

const selectBtn = document.getElementById("selectBtn");
const rectangleBtn = document.getElementById("rectangleBtn");
const textBtn = document.getElementById("textBtn");
const calloutBtn = document.getElementById("calloutBtn");
const deleteBtn = document.getElementById("deleteBtn");

const strokeColorInput = document.getElementById("strokeColorInput");
const fillColorInput = document.getElementById("fillColorInput");
const fillOpacityInput = document.getElementById("fillOpacityInput");
const lineWidthInput = document.getElementById("lineWidthInput");
const textContentInput = document.getElementById("textContentInput");
const textColorInput = document.getElementById("textColorInput");
const fontSizeInput = document.getElementById("fontSizeInput");

const viewer = document.getElementById("viewer");
const canvasContainer = document.getElementById("canvasContainer");

const canvas = document.getElementById("pdfCanvas");
const ctx = canvas.getContext("2d");

const annotationCanvas = document.getElementById("annotationCanvas");
const annotationCtx = annotationCanvas.getContext("2d");

/* **************************************************
   APPLICATION STATE

   State is the app's memory. Keeping these values
   together makes it easier to see what can change
   while the user works.
   ************************************************** */

let pdf = null;
let currentFileName = "";
let currentDocumentTitle = "Untitled";
let documentType = "none";
let currentPdfDataBase64 = "";

let currentPage = 1;
let totalPages = 0;

let scale = 1.0;
let zoomMode = "fitPage";
let rendering = false;
let exporting = false;

let activeTool = "select";

let currentStrokeColor = "#00ff66";
let currentFillColor = "#00ff66";
let currentFillOpacity = 0.12;
let currentLineWidth = 2;
let currentTextColor = "#111111";
let currentFontSize = 16;
let currentTextContent = "Text";

let annotations = [];
let selectedAnnotation = null;

let mouseX = 0;
let mouseY = 0;
let pdfX = 0;
let pdfY = 0;

let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

let isResizing = false;
let activeResizeHandle = null;
let resizeAnchorPdfX = 0;
let resizeAnchorPdfY = 0;

let isDraggingLeader = false;

let isDrawingRectangle = false;
let rectangleStartPdfX = 0;
let rectangleStartPdfY = 0;

let isDrawingTextBox = false;
let textStartPdfX = 0;
let textStartPdfY = 0;

let isDrawingCallout = false;
let calloutStartPdfX = 0;
let calloutStartPdfY = 0;

let previewAnnotation = null;

const blankPageWidth = 816;
const blankPageHeight = 1056;
const defaultCalloutWidth = 180;
const defaultCalloutHeight = 70;

/* **************************************************
   STARTUP

   The app starts with PDF-only controls disabled.
   They become available after a PDF is loaded.
   ************************************************** */

initializeUi();
updateToolButtons();
updatePropertiesPanel();

function hasDocument() {

    return documentType !== "none";
}

function initializeUi() {

    prevBtn.disabled = true;
    nextBtn.disabled = true;

    zoomInBtn.disabled = true;
    zoomOutBtn.disabled = true;

    fitPageBtn.disabled = true;
    fitWidthBtn.disabled = true;
    actualSizeBtn.disabled = true;

    saveProjectBtn.disabled = true;
    exportPdfBtn.disabled = true;
    documentTitleInput.disabled = true;

    strokeColorInput.disabled = true;
    fillColorInput.disabled = true;
    fillOpacityInput.disabled = true;
    lineWidthInput.disabled = true;
    textContentInput.disabled = true;
    textColorInput.disabled = true;
    fontSizeInput.disabled = true;
}

function enablePdfControls() {

    zoomInBtn.disabled = false;
    zoomOutBtn.disabled = false;

    fitPageBtn.disabled = false;
    fitWidthBtn.disabled = false;
    actualSizeBtn.disabled = false;

    saveProjectBtn.disabled = false;
    exportPdfBtn.disabled = false;
    documentTitleInput.disabled = false;
}

/* **************************************************
   FILE HELPERS

   Project save/load uses JSON.
   PDF projects include the original PDF bytes as base64
   so the work file can be reopened later.
   ************************************************** */

function makeSafeFileName(fileName) {

    return fileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-z0-9-_]+/gi, "_")
        .replace(/^_+|_+$/g, "") || "markup";
}

function getDocumentTitle() {

    return documentTitleInput.value.trim() || "Untitled";
}

function setDocumentTitle(title) {

    currentDocumentTitle =
        title || "Untitled";

    documentTitleInput.value =
        currentDocumentTitle;
}

function arrayBufferToBase64(buffer) {

    const bytes =
        new Uint8Array(buffer);

    let binary = "";

    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary);
}

function base64ToUint8Array(base64) {

    const binary =
        atob(base64);

    const bytes =
        new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

function downloadBlob(blob, fileName) {

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

/* **************************************************
   FILE OPENING

   The browser gives us the selected PDF as a File.
   PDF.js reads its ArrayBuffer and creates the pdf
   document object used by renderPage().
   ************************************************** */

openBtn.addEventListener("click", () => {
    fileInput.click();
});

newBlankBtn.addEventListener("click", async () => {

    pdf = null;
    documentType = "blank";
    currentPdfDataBase64 = "";

    currentFileName = "Blank document";
    setDocumentTitle("Blank document");
    currentPage = 1;
    totalPages = 1;
    zoomMode = "fitPage";

    annotations = [];
    selectedAnnotation = null;

    enablePdfControls();
    updatePropertiesPanel();

    await renderPage();
});

fileInput.addEventListener("change", async (event) => {

    const file = event.target.files[0];

    if (!file) {
        return;
    }

    currentFileName = file.name;
    setDocumentTitle(
        file.name.replace(/\.[^/.]+$/, "")
    );
    documentType = "pdf";

    currentPage = 1;

    zoomMode = "fitPage";

    annotations = [];
    selectedAnnotation = null;

    statusBar.textContent =
        `Loading ${file.name}`;

    const buffer =
        await file.arrayBuffer();

    currentPdfDataBase64 =
        arrayBufferToBase64(buffer);

    pdf = await pdfjsLib.getDocument({
        data: buffer
    }).promise;

    totalPages = pdf.numPages;

    enablePdfControls();
    updatePropertiesPanel();

    await renderPage();
});

documentTitleInput.addEventListener("input", () => {

    currentDocumentTitle =
        getDocumentTitle();
});

/* **************************************************
   PROJECT SAVE / OPEN

   A project file is the work-in-progress format.
   It keeps the source document plus editable annotation
   data instead of flattening everything into pixels.
   ************************************************** */

function createProjectData() {

    return {
        app: "PDF Markup Tool",
        version: 1,
        documentType,
        currentFileName,
        currentDocumentTitle: getDocumentTitle(),
        currentPdfDataBase64,
        blankPageWidth,
        blankPageHeight,
        currentPage,
        totalPages,
        zoomMode,
        defaults: {
            currentStrokeColor,
            currentFillColor,
            currentFillOpacity,
            currentLineWidth,
            currentTextColor,
            currentFontSize,
            currentTextContent
        },
        annotations
    };
}

function restoreDefaults(defaults) {

    if (!defaults) {
        return;
    }

    currentStrokeColor =
        defaults.currentStrokeColor || currentStrokeColor;

    currentFillColor =
        defaults.currentFillColor || currentFillColor;

    currentFillOpacity =
        defaults.currentFillOpacity ?? currentFillOpacity;

    currentLineWidth =
        defaults.currentLineWidth ?? currentLineWidth;

    currentTextColor =
        defaults.currentTextColor || currentTextColor;

    currentFontSize =
        defaults.currentFontSize ?? currentFontSize;

    currentTextContent =
        defaults.currentTextContent || currentTextContent;
}

saveProjectBtn.addEventListener("click", () => {

    if (
        !hasDocument()
    ) {
        return;
    }

    const projectData =
        createProjectData();

    const json =
        JSON.stringify(projectData, null, 2);

    const blob =
        new Blob(
            [json],
            {
                type: "application/json"
            }
        );

    const fileName =
        `${makeSafeFileName(getDocumentTitle())}.markup`;

    downloadBlob(blob, fileName);
});

openProjectBtn.addEventListener("click", () => {
    projectFileInput.click();
});

projectFileInput.addEventListener("change", async (event) => {

    const file =
        event.target.files[0];

    if (
        !file
    ) {
        return;
    }

    const text =
        await file.text();

    const projectData =
        JSON.parse(text);

    documentType =
        projectData.documentType;

    currentFileName =
        projectData.currentFileName || file.name;

    setDocumentTitle(
        projectData.currentDocumentTitle ||
        currentFileName.replace(/\.[^/.]+$/, "")
    );

    currentPdfDataBase64 =
        projectData.currentPdfDataBase64 || "";

    currentPage =
        projectData.currentPage || 1;

    totalPages =
        projectData.totalPages || 1;

    zoomMode =
        projectData.zoomMode || "fitPage";

    annotations =
        projectData.annotations || [];

    selectedAnnotation = null;

    restoreDefaults(projectData.defaults);

    if (
        documentType === "pdf"
    ) {
        const pdfBytes =
            base64ToUint8Array(currentPdfDataBase64);

        pdf =
            await pdfjsLib.getDocument({
                data: pdfBytes
            }).promise;

        totalPages =
            pdf.numPages;
    }

    else {
        pdf = null;
        documentType = "blank";
        totalPages = 1;
        currentPage = 1;
    }

    enablePdfControls();
    updatePropertiesPanel();

    await renderPage();

    projectFileInput.value = "";
});

/* **************************************************
   FLATTENED PDF EXPORT

   Export is different from project save:
   - Project save keeps editable annotation objects.
   - Export PDF burns the visible result into a new PDF.
   ************************************************** */

function createFlattenedPageCanvas() {

    const flattenedCanvas =
        document.createElement("canvas");

    flattenedCanvas.width =
        canvas.width;

    flattenedCanvas.height =
        canvas.height;

    const flattenedCtx =
        flattenedCanvas.getContext("2d");

    flattenedCtx.drawImage(
        canvas,
        0,
        0
    );

    flattenedCtx.drawImage(
        annotationCanvas,
        0,
        0
    );

    return flattenedCanvas;
}

function getPdfOrientation(width, height) {

    if (
        width > height
    ) {
        return "landscape";
    }

    return "portrait";
}

exportPdfBtn.addEventListener("click", async () => {

    if (
        !hasDocument()
    ) {
        return;
    }

    if (
        !window.jspdf ||
        !window.jspdf.jsPDF
    ) {
        statusBar.textContent =
            "PDF export library is not loaded.";

        return;
    }

    const originalPage =
        currentPage;

    const originalZoomMode =
        zoomMode;

    const originalScale =
        scale;

    const originalSelection =
        selectedAnnotation;

    let outputPdf = null;

    try {

        exporting = true;
        selectedAnnotation = null;
        zoomMode = "manual";
        scale = 1.5;

        for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {

            currentPage = pageNumber;

            statusBar.textContent =
                `Exporting page ${pageNumber} of ${totalPages}`;

            await renderPage();

            const flattenedCanvas =
                createFlattenedPageCanvas();

            const imageData =
                flattenedCanvas.toDataURL("image/jpeg", 0.95);

            const pageWidth =
                flattenedCanvas.width;

            const pageHeight =
                flattenedCanvas.height;

            if (
                !outputPdf
            ) {
                outputPdf =
                    new window.jspdf.jsPDF({
                        orientation: getPdfOrientation(pageWidth, pageHeight),
                        unit: "px",
                        format: [pageWidth, pageHeight]
                    });
            }

            else {
                outputPdf.addPage(
                    [pageWidth, pageHeight],
                    getPdfOrientation(pageWidth, pageHeight)
                );
            }

            outputPdf.addImage(
                imageData,
                "JPEG",
                0,
                0,
                pageWidth,
                pageHeight
            );
        }

        outputPdf.save(
            `${makeSafeFileName(getDocumentTitle())}_marked.pdf`
        );
    }

    finally {

        exporting = false;

        currentPage =
            originalPage;

        zoomMode =
            originalZoomMode;

        scale =
            originalScale;

        selectedAnnotation =
            originalSelection;

        await renderPage();
    }
});

/* **************************************************
   PAGE NAVIGATION
   ************************************************** */

prevBtn.addEventListener("click", async () => {

    if (!hasDocument() || currentPage <= 1) {
        return;
    }

    currentPage--;

    await renderPage();
});

nextBtn.addEventListener("click", async () => {

    if (!hasDocument() || currentPage >= totalPages) {
        return;
    }

    currentPage++;

    await renderPage();
});

/* **************************************************
   TOOL SELECTION

   activeTool controls what a click or drag on the
   annotation canvas means.
   ************************************************** */

function updateToolButtons() {

    selectBtn.classList.remove("active");
    rectangleBtn.classList.remove("active");
    textBtn.classList.remove("active");
    calloutBtn.classList.remove("active");
    deleteBtn.classList.remove("active");

    if (activeTool === "select") {
        selectBtn.classList.add("active");
    }

    else if (activeTool === "rectangle") {
        rectangleBtn.classList.add("active");
    }

    else if (activeTool === "text") {
        textBtn.classList.add("active");
    }

    else if (activeTool === "callout") {
        calloutBtn.classList.add("active");
    }

    else if (activeTool === "delete") {
        deleteBtn.classList.add("active");
    }
}

selectBtn.addEventListener("click", () => {

    activeTool = "select";

    updateToolButtons();
});

rectangleBtn.addEventListener("click", () => {

    activeTool = "rectangle";

    updateToolButtons();
});

textBtn.addEventListener("click", () => {

    activeTool = "text";

    updateToolButtons();
});

calloutBtn.addEventListener("click", () => {

    activeTool = "callout";

    updateToolButtons();
});

deleteBtn.addEventListener("click", () => {

    activeTool = "delete";

    updateToolButtons();
});

/* **************************************************
   ANNOTATION PROPERTIES

   These controls do two jobs:
   - When a rectangle is selected, they edit it.
   - When nothing is selected, they set the defaults
     for the next rectangle.
   ************************************************** */

function updatePropertiesPanel() {

    if (
        !hasDocument()
    ) {
        strokeColorInput.disabled = true;
        fillColorInput.disabled = true;
        fillOpacityInput.disabled = true;
        lineWidthInput.disabled = true;
        textContentInput.disabled = true;
        textColorInput.disabled = true;
        fontSizeInput.disabled = true;

        return;
    }

    const hasSelection =
        selectedAnnotation &&
        (
            selectedAnnotation.type === "rectangle" ||
            selectedAnnotation.type === "text" ||
            selectedAnnotation.type === "callout"
        );

    const hasTextSelection =
        selectedAnnotation &&
        (
            selectedAnnotation.type === "text" ||
            selectedAnnotation.type === "callout"
        );

    strokeColorInput.disabled = false;
    fillColorInput.disabled = false;
    fillOpacityInput.disabled = false;
    lineWidthInput.disabled = false;
    textContentInput.disabled = !hasTextSelection;
    textColorInput.disabled = !hasTextSelection;
    fontSizeInput.disabled = !hasTextSelection;

    if (
        hasSelection
    ) {
        strokeColorInput.value =
            selectedAnnotation.strokeColor;

        fillColorInput.value =
            selectedAnnotation.fillColor;

        fillOpacityInput.value =
            selectedAnnotation.fillOpacity;

        lineWidthInput.value =
            selectedAnnotation.lineWidth;

        if (
            hasTextSelection
        ) {
            textContentInput.value =
                selectedAnnotation.text;

            textColorInput.value =
                selectedAnnotation.textColor;

            fontSizeInput.value =
                selectedAnnotation.fontSize;
        }

        else {
            textContentInput.value = "";
            textColorInput.value =
                currentTextColor;
            fontSizeInput.value =
                currentFontSize;
        }

        return;
    }

    strokeColorInput.value =
        currentStrokeColor;

    fillColorInput.value =
        currentFillColor;

    fillOpacityInput.value =
        currentFillOpacity;

    lineWidthInput.value =
        currentLineWidth;

    textContentInput.value =
        currentTextContent;

    textColorInput.value =
        currentTextColor;

    fontSizeInput.value =
        currentFontSize;
}

function applyPropertiesToSelection() {

    currentStrokeColor =
        strokeColorInput.value;

    currentFillColor =
        fillColorInput.value;

    currentFillOpacity =
        Number(fillOpacityInput.value);

    currentLineWidth =
        Number(lineWidthInput.value);

    currentTextContent =
        textContentInput.value || "Text";

    currentTextColor =
        textColorInput.value;

    currentFontSize =
        Number(fontSizeInput.value);

    if (
        selectedAnnotation &&
        (
            selectedAnnotation.type === "rectangle" ||
            selectedAnnotation.type === "text" ||
            selectedAnnotation.type === "callout"
        )
    ) {
        selectedAnnotation.strokeColor =
            currentStrokeColor;

        selectedAnnotation.fillColor =
            currentFillColor;

        selectedAnnotation.fillOpacity =
            currentFillOpacity;

        selectedAnnotation.lineWidth =
            currentLineWidth;

        if (
            selectedAnnotation.type === "text" ||
            selectedAnnotation.type === "callout"
        ) {
            selectedAnnotation.text =
                currentTextContent;

            selectedAnnotation.textColor =
                currentTextColor;

            selectedAnnotation.fontSize =
                currentFontSize;
        }

        drawAnnotations();
    }
}

strokeColorInput.addEventListener("input", applyPropertiesToSelection);
fillColorInput.addEventListener("input", applyPropertiesToSelection);
fillOpacityInput.addEventListener("input", applyPropertiesToSelection);
lineWidthInput.addEventListener("input", applyPropertiesToSelection);
textContentInput.addEventListener("input", applyPropertiesToSelection);
textColorInput.addEventListener("input", applyPropertiesToSelection);
fontSizeInput.addEventListener("input", applyPropertiesToSelection);

/* **************************************************
   ZOOM
   ************************************************** */

zoomInBtn.addEventListener("click", async () => {

    if (!hasDocument()) return;

    zoomMode = "manual";

    scale += 0.25;

    await renderPage();
});

zoomOutBtn.addEventListener("click", async () => {

    if (!hasDocument()) return;

    if (scale <= 0.50) return;

    zoomMode = "manual";

    scale -= 0.25;

    await renderPage();
});

fitPageBtn.addEventListener("click", async () => {

    if (!hasDocument()) return;

    zoomMode = "fitPage";

    await renderPage();
});

fitWidthBtn.addEventListener("click", async () => {

    if (!hasDocument()) return;

    zoomMode = "fitWidth";

    await renderPage();
});

actualSizeBtn.addEventListener("click", async () => {

    if (!hasDocument()) return;

    zoomMode = "manual";

    scale = 1.0;

    await renderPage();
});

/* **************************************************
   ZOOM HELPERS

   PDF.js can give us the page size at scale 1.
   From that we calculate the scale needed to fit
   inside the visible viewer area.
   ************************************************** */

function updateZoomButtons() {

    fitPageBtn.classList.remove("active");
    fitWidthBtn.classList.remove("active");
    actualSizeBtn.classList.remove("active");

    if (zoomMode === "fitPage") {
        fitPageBtn.classList.add("active");
    }

    else if (zoomMode === "fitWidth") {
        fitWidthBtn.classList.add("active");
    }

    else {
        actualSizeBtn.classList.add("active");
    }
}

function calculateFitPage(page) {

    const baseViewport =
        page.getViewport({ scale: 1 });

    const availableWidth =
        viewer.clientWidth - 20;

    const availableHeight =
        viewer.clientHeight - 20;

    const widthScale =
        availableWidth /
        baseViewport.width;

    const heightScale =
        availableHeight /
        baseViewport.height;

    return Math.min(
        widthScale,
        heightScale
    );
}

function calculateFitWidth(page) {

    const baseViewport =
        page.getViewport({ scale: 1 });

    const availableWidth =
        viewer.clientWidth - 20;

    return (
        availableWidth /
        baseViewport.width
    );
}

function calculateFitPageFromSize(pageWidth, pageHeight) {

    const availableWidth =
        viewer.clientWidth - 20;

    const availableHeight =
        viewer.clientHeight - 20;

    const widthScale =
        availableWidth /
        pageWidth;

    const heightScale =
        availableHeight /
        pageHeight;

    return Math.min(
        widthScale,
        heightScale
    );
}

function calculateFitWidthFromSize(pageWidth) {

    const availableWidth =
        viewer.clientWidth - 20;

    return (
        availableWidth /
        pageWidth
    );
}

/* **************************************************
   ANNOTATION HIT TESTING

   Hit testing answers the question:
   "Did the user click close enough to an annotation?"

   Rectangular annotations use simple bounds checking.
   Later this same section will grow into circle bounds,
   line handles, callouts, and symbol stamps.
   ************************************************** */

function normalizeRectangle(x1, y1, x2, y2) {

    return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1)
    };
}

function getRectangleHandles(annotation) {

    return [
        {
            name: "topLeft",
            x: annotation.x,
            y: annotation.y,
            anchorX: annotation.x + annotation.width,
            anchorY: annotation.y + annotation.height
        },
        {
            name: "topRight",
            x: annotation.x + annotation.width,
            y: annotation.y,
            anchorX: annotation.x,
            anchorY: annotation.y + annotation.height
        },
        {
            name: "bottomRight",
            x: annotation.x + annotation.width,
            y: annotation.y + annotation.height,
            anchorX: annotation.x,
            anchorY: annotation.y
        },
        {
            name: "bottomLeft",
            x: annotation.x,
            y: annotation.y + annotation.height,
            anchorX: annotation.x + annotation.width,
            anchorY: annotation.y
        }
    ];
}

function hitTestResizeHandle(annotation, pdfX, pdfY) {

    if (
        annotation.page !== currentPage
    ) {
        return null;
    }

    const handleRadius =
        8 / scale;

    const handles =
        getRectangleHandles(annotation);

    for (let i = 0; i < handles.length; i++) {

        const handle =
            handles[i];

        if (
            Math.abs(pdfX - handle.x) <= handleRadius &&
            Math.abs(pdfY - handle.y) <= handleRadius
        ) {
            return handle;
        }
    }

    return null;
}

function hitTestLeaderHandle(annotation, pdfX, pdfY) {

    if (
        !annotation ||
        annotation.type !== "callout" ||
        annotation.page !== currentPage
    ) {
        return false;
    }

    const handleRadius =
        10 / scale;

    return (
        Math.abs(pdfX - annotation.leaderX) <= handleRadius &&
        Math.abs(pdfY - annotation.leaderY) <= handleRadius
    );
}

function hitTestAnnotation(pdfX, pdfY) {

    for (let i = annotations.length - 1; i >= 0; i--) {

        const annotation =
            annotations[i];

        if (
            annotation.page !== currentPage
        ) {
            continue;
        }

        if (
            (
                annotation.type === "rectangle" ||
                annotation.type === "text" ||
                annotation.type === "callout"
            ) &&
            pdfX >= annotation.x &&
            pdfX <= annotation.x + annotation.width &&
            pdfY >= annotation.y &&
            pdfY <= annotation.y + annotation.height
        ) {
            return annotation;
        }
    }

    return null;
}

/* **************************************************
   ANNOTATION DRAWING

   The PDF is drawn on pdfCanvas.
   Markups are drawn separately on annotationCanvas.

   That separation lets us redraw annotations quickly
   without re-rendering the PDF page every time the
   mouse moves.
   ************************************************** */

function colorToRgba(hexColor, opacity) {

    const red =
        parseInt(hexColor.slice(1, 3), 16);

    const green =
        parseInt(hexColor.slice(3, 5), 16);

    const blue =
        parseInt(hexColor.slice(5, 7), 16);

    return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function drawRectangleHandles(annotation) {

    const handleSize = 8;
    const handles = getRectangleHandles(annotation);

    annotationCtx.fillStyle = "#ffffff";
    annotationCtx.strokeStyle = "#111111";
    annotationCtx.lineWidth = 1;

    handles.forEach(handle => {

        const screenX =
            handle.x * scale;

        const screenY =
            handle.y * scale;

        annotationCtx.fillRect(
            screenX - handleSize / 2,
            screenY - handleSize / 2,
            handleSize,
            handleSize
        );

        annotationCtx.strokeRect(
            screenX - handleSize / 2,
            screenY - handleSize / 2,
            handleSize,
            handleSize
        );
    });
}

function drawRectangleAnnotation(annotation) {

    const screenX =
        annotation.x * scale;

    const screenY =
        annotation.y * scale;

    const screenWidth =
        annotation.width * scale;

    const screenHeight =
        annotation.height * scale;

    annotationCtx.fillStyle =
        colorToRgba(
            annotation.fillColor,
            annotation.fillOpacity
        );

    annotationCtx.strokeStyle =
        annotation.strokeColor;

    annotationCtx.lineWidth =
        annotation.lineWidth;

    annotationCtx.fillRect(
        screenX,
        screenY,
        screenWidth,
        screenHeight
    );

    annotationCtx.strokeRect(
        screenX,
        screenY,
        screenWidth,
        screenHeight
    );

    if (
        annotation === selectedAnnotation
    ) {

        annotationCtx.strokeStyle =
            "yellow";

        annotationCtx.lineWidth = 2;

        annotationCtx.strokeRect(
            screenX - 3,
            screenY - 3,
            screenWidth + 6,
            screenHeight + 6
        );

        drawRectangleHandles(annotation);
    }
}

function drawWrappedText(annotation, screenX, screenY, screenWidth) {

    const padding =
        6 * scale;

    const lineHeight =
        annotation.fontSize * scale * 1.25;

    const maxTextWidth =
        screenWidth - padding * 2;

    let cursorY =
        screenY + padding + annotation.fontSize * scale;

    annotationCtx.fillStyle =
        annotation.textColor;

    annotationCtx.font =
        `${annotation.fontSize * scale}px Arial`;

    annotationCtx.textBaseline =
        "alphabetic";

    const paragraphs =
        annotation.text.split("\n");

    paragraphs.forEach(paragraph => {

        const words =
            paragraph.split(" ");

        let line = "";

        words.forEach(word => {

            const testLine =
                line ? `${line} ${word}` : word;

            const testWidth =
                annotationCtx.measureText(testLine).width;

            if (
                testWidth > maxTextWidth &&
                line
            ) {
                annotationCtx.fillText(
                    line,
                    screenX + padding,
                    cursorY
                );

                line = word;
                cursorY += lineHeight;
            }

            else {
                line = testLine;
            }
        });

        if (
            line
        ) {
            annotationCtx.fillText(
                line,
                screenX + padding,
                cursorY
            );
        }

        cursorY += lineHeight;
    });
}

function drawTextAnnotation(annotation) {

    const screenX =
        annotation.x * scale;

    const screenY =
        annotation.y * scale;

    const screenWidth =
        annotation.width * scale;

    const screenHeight =
        annotation.height * scale;

    drawRectangleAnnotation(annotation);
    drawWrappedText(annotation, screenX, screenY, screenWidth, screenHeight);
}

function getBoxEdgePointTowardLeader(annotation) {

    const centerX =
        annotation.x + annotation.width / 2;

    const centerY =
        annotation.y + annotation.height / 2;

    const dx =
        annotation.leaderX - centerX;

    const dy =
        annotation.leaderY - centerY;

    if (
        dx === 0 &&
        dy === 0
    ) {
        return {
            x: centerX,
            y: centerY
        };
    }

    const halfWidth =
        annotation.width / 2;

    const halfHeight =
        annotation.height / 2;

    const scaleToEdge =
        Math.min(
            Math.abs(halfWidth / dx) || Infinity,
            Math.abs(halfHeight / dy) || Infinity
        );

    return {
        x: centerX + dx * scaleToEdge,
        y: centerY + dy * scaleToEdge
    };
}

function drawLeaderLine(annotation) {

    const boxEdgePoint =
        getBoxEdgePointTowardLeader(annotation);

    const boxEdgeX =
        boxEdgePoint.x * scale;

    const boxEdgeY =
        boxEdgePoint.y * scale;

    const leaderX =
        annotation.leaderX * scale;

    const leaderY =
        annotation.leaderY * scale;

    annotationCtx.strokeStyle =
        annotation.strokeColor;

    annotationCtx.fillStyle =
        annotation.strokeColor;

    annotationCtx.lineWidth =
        annotation.lineWidth;

    annotationCtx.beginPath();

    annotationCtx.moveTo(
        boxEdgeX,
        boxEdgeY
    );

    annotationCtx.lineTo(
        leaderX,
        leaderY
    );

    annotationCtx.stroke();

    const angle =
        Math.atan2(
            leaderY - boxEdgeY,
            leaderX - boxEdgeX
        );

    const arrowLength = 12;

    annotationCtx.beginPath();

    annotationCtx.moveTo(
        leaderX,
        leaderY
    );

    annotationCtx.lineTo(
        leaderX - Math.cos(angle - Math.PI / 6) * arrowLength,
        leaderY - Math.sin(angle - Math.PI / 6) * arrowLength
    );

    annotationCtx.lineTo(
        leaderX - Math.cos(angle + Math.PI / 6) * arrowLength,
        leaderY - Math.sin(angle + Math.PI / 6) * arrowLength
    );

    annotationCtx.closePath();
    annotationCtx.fill();

    if (
        annotation === selectedAnnotation
    ) {
        annotationCtx.fillStyle = "#ffffff";
        annotationCtx.strokeStyle = "#111111";
        annotationCtx.lineWidth = 1;

        annotationCtx.beginPath();

        annotationCtx.arc(
            leaderX,
            leaderY,
            6,
            0,
            Math.PI * 2
        );

        annotationCtx.fill();
        annotationCtx.stroke();
    }
}

function drawCalloutAnnotation(annotation) {

    drawLeaderLine(annotation);
    drawTextAnnotation(annotation);
}

function drawAnnotations() {

    annotationCtx.clearRect(
        0,
        0,
        annotationCanvas.width,
        annotationCanvas.height
    );

    /* Stored annotations */

    annotations.forEach(annotation => {

        if (
            annotation.page !== currentPage
        ) {
            return;
        }

        if (
            annotation.type === "rectangle"
        ) {
            drawRectangleAnnotation(annotation);
        }

        else if (
            annotation.type === "text"
        ) {
            drawTextAnnotation(annotation);
        }

        else if (
            annotation.type === "callout"
        ) {
            drawCalloutAnnotation(annotation);
        }
    });

    if (
        previewAnnotation
    ) {
        if (
            previewAnnotation.type === "callout"
        ) {
            drawCalloutAnnotation(previewAnnotation);
        }

        else if (
            previewAnnotation.type === "text"
        ) {
            drawTextAnnotation(previewAnnotation);
        }

        else {
            drawRectangleAnnotation(previewAnnotation);
        }
    }

    if (
        exporting
    ) {
        return;
    }

    /* Mouse crosshair */

    annotationCtx.strokeStyle = "red";
    annotationCtx.lineWidth = 1;

    annotationCtx.beginPath();

    annotationCtx.moveTo(
        mouseX - 10,
        mouseY
    );

    annotationCtx.lineTo(
        mouseX + 10,
        mouseY
    );

    annotationCtx.moveTo(
        mouseX,
        mouseY - 10
    );

    annotationCtx.lineTo(
        mouseX,
        mouseY + 10
    );

    annotationCtx.stroke();
}

/* **************************************************
   ANNOTATION CANVAS EVENTS

   Mouse events are captured on the overlay canvas.
   We convert screen-space coordinates into PDF-space
   coordinates so annotations keep the correct location
   when the zoom level changes.
   ************************************************** */

function updatePointerPosition(event) {

    const rect =
        annotationCanvas.getBoundingClientRect();

    mouseX =
        event.clientX - rect.left;

    mouseY =
        event.clientY - rect.top;

    pdfX =
        Math.round(mouseX / scale);

    pdfY =
        Math.round(mouseY / scale);
}

function createRectangleAnnotation(x, y, width, height) {

    return {
        type: "rectangle",
        page: currentPage,
        x,
        y,
        width,
        height,
        strokeColor: currentStrokeColor,
        fillColor: currentFillColor,
        fillOpacity: currentFillOpacity,
        lineWidth: currentLineWidth
    };
}

function createTextAnnotation(x, y, width, height) {

    return {
        type: "text",
        page: currentPage,
        x,
        y,
        width,
        height,
        strokeColor: "#111111",
        fillColor: "#ffffff",
        fillOpacity: 0.85,
        lineWidth: 1,
        text: currentTextContent || "Text",
        textColor: currentTextColor,
        fontSize: currentFontSize
    };
}

function createCalloutAnnotation(x, y, width, height, leaderX, leaderY) {

    return {
        type: "callout",
        page: currentPage,
        x,
        y,
        width,
        height,
        leaderX,
        leaderY,
        strokeColor: "#111111",
        fillColor: "#ffffff",
        fillOpacity: 0.9,
        lineWidth: 2,
        text: currentTextContent || "Callout",
        textColor: currentTextColor,
        fontSize: currentFontSize
    };
}

function resizeSelectedRectangularAnnotation() {

    if (
        !selectedAnnotation ||
        (
            selectedAnnotation.type !== "rectangle" &&
            selectedAnnotation.type !== "text" &&
            selectedAnnotation.type !== "callout"
        )
    ) {
        return;
    }

    /*
       Resizing keeps the corner opposite the handle fixed.
       The mouse becomes the moving corner. normalizeRectangle()
       lets the user drag past the anchor and still get a valid
       rectangle with positive width and height.
    */
    const rectangle =
        normalizeRectangle(
            resizeAnchorPdfX,
            resizeAnchorPdfY,
            pdfX,
            pdfY
        );

    selectedAnnotation.x =
        rectangle.x;

    selectedAnnotation.y =
        rectangle.y;

    selectedAnnotation.width =
        rectangle.width;

    selectedAnnotation.height =
        rectangle.height;
}

annotationCanvas.addEventListener(
    "mousemove",
    (event) => {

        updatePointerPosition(event);

        if (
            isResizing
        ) {

            resizeSelectedRectangularAnnotation();

            drawAnnotations();
        }

        if (
            isDraggingLeader &&
            selectedAnnotation &&
            selectedAnnotation.type === "callout"
        ) {
            selectedAnnotation.leaderX = pdfX;
            selectedAnnotation.leaderY = pdfY;

            drawAnnotations();
        }

        if (
            isDragging &&
            selectedAnnotation
        ) {

            selectedAnnotation.x =
                pdfX - dragOffsetX;

            selectedAnnotation.y =
                pdfY - dragOffsetY;

            drawAnnotations();
        }

        if (
            isDrawingRectangle
        ) {

            const rectangle =
                normalizeRectangle(
                    rectangleStartPdfX,
                    rectangleStartPdfY,
                    pdfX,
                    pdfY
                );

            previewAnnotation =
                createRectangleAnnotation(
                    rectangle.x,
                    rectangle.y,
                    rectangle.width,
                    rectangle.height
                );

            previewAnnotation.strokeColor =
                "#ffff00";

            previewAnnotation.fillColor =
                "#ffff00";

            previewAnnotation.fillOpacity =
                0.10;
        }

        if (
            isDrawingTextBox
        ) {

            const rectangle =
                normalizeRectangle(
                    textStartPdfX,
                    textStartPdfY,
                    pdfX,
                    pdfY
                );

            previewAnnotation =
                createTextAnnotation(
                    rectangle.x,
                    rectangle.y,
                    rectangle.width,
                    rectangle.height
                );

            previewAnnotation.strokeColor =
                "#ffff00";

            previewAnnotation.fillColor =
                "#ffff00";

            previewAnnotation.fillOpacity =
                0.10;
        }

        if (
            isDrawingCallout
        ) {

            previewAnnotation =
                createCalloutAnnotation(
                    pdfX,
                    pdfY,
                    defaultCalloutWidth,
                    defaultCalloutHeight,
                    calloutStartPdfX,
                    calloutStartPdfY
                );

            previewAnnotation.strokeColor =
                "#ffff00";

            previewAnnotation.fillColor =
                "#ffff00";

            previewAnnotation.fillOpacity =
                0.10;
        }

        statusBar.textContent =
            `Page ${currentPage}/${totalPages} | PDF X:${pdfX} Y:${pdfY}`;

        drawAnnotations();
    }
);

annotationCanvas.addEventListener(
    "mousedown",
    (event) => {

        updatePointerPosition(event);

        if (
            activeTool === "rectangle"
        ) {

            rectangleStartPdfX = pdfX;
            rectangleStartPdfY = pdfY;

            previewAnnotation =
                createRectangleAnnotation(
                    pdfX,
                    pdfY,
                    0,
                    0
                );

            previewAnnotation.strokeColor =
                "#ffff00";

            previewAnnotation.fillColor =
                "#ffff00";

            previewAnnotation.fillOpacity =
                0.10;

            isDrawingRectangle = true;

            drawAnnotations();

            return;
        }

        if (
            activeTool === "text"
        ) {

            textStartPdfX = pdfX;
            textStartPdfY = pdfY;

            previewAnnotation =
                createTextAnnotation(
                    pdfX,
                    pdfY,
                    0,
                    0
                );

            previewAnnotation.strokeColor =
                "#ffff00";

            previewAnnotation.fillColor =
                "#ffff00";

            previewAnnotation.fillOpacity =
                0.10;

            isDrawingTextBox = true;

            drawAnnotations();

            return;
        }

        if (
            activeTool === "callout"
        ) {

            calloutStartPdfX = pdfX;
            calloutStartPdfY = pdfY;

            previewAnnotation =
                createCalloutAnnotation(
                    pdfX,
                    pdfY,
                    defaultCalloutWidth,
                    defaultCalloutHeight,
                    calloutStartPdfX,
                    calloutStartPdfY
                );

            previewAnnotation.strokeColor =
                "#ffff00";

            previewAnnotation.fillColor =
                "#ffff00";

            previewAnnotation.fillOpacity =
                0.10;

            isDrawingCallout = true;

            drawAnnotations();

            return;
        }

        if (
            activeTool !== "select"
        ) {
            return;
        }

        if (
            selectedAnnotation
        ) {

            if (
                hitTestLeaderHandle(
                    selectedAnnotation,
                    pdfX,
                    pdfY
                )
            ) {
                isDraggingLeader = true;

                drawAnnotations();

                return;
            }

            const handle =
                hitTestResizeHandle(
                    selectedAnnotation,
                    pdfX,
                    pdfY
                );

            if (
                handle
            ) {

                activeResizeHandle =
                    handle.name;

                resizeAnchorPdfX =
                    handle.anchorX;

                resizeAnchorPdfY =
                    handle.anchorY;

                isResizing = true;

                drawAnnotations();

                return;
            }
        }

        selectedAnnotation =
            hitTestAnnotation(
                pdfX,
                pdfY
            );

        if (
            !selectedAnnotation
        ) {
            updatePropertiesPanel();
            drawAnnotations();
            return;
        }

        dragOffsetX =
            pdfX -
            selectedAnnotation.x;

        dragOffsetY =
            pdfY -
            selectedAnnotation.y;

        isDragging = true;

        updatePropertiesPanel();
        drawAnnotations();
    }
);

annotationCanvas.addEventListener(
    "mouseup",
    (event) => {

        updatePointerPosition(event);

        if (
            isDrawingRectangle
        ) {

            const rectangle =
                normalizeRectangle(
                    rectangleStartPdfX,
                    rectangleStartPdfY,
                    pdfX,
                    pdfY
                );

            isDrawingRectangle = false;
            previewAnnotation = null;

            if (
                rectangle.width >= 3 &&
                rectangle.height >= 3
            ) {

                const annotation =
                    createRectangleAnnotation(
                        rectangle.x,
                        rectangle.y,
                        rectangle.width,
                        rectangle.height
                    );

                annotations.push(annotation);

                selectedAnnotation = annotation;
                activeTool = "select";

                updateToolButtons();
                updatePropertiesPanel();
            }

            drawAnnotations();

            return;
        }

        if (
            isDrawingTextBox
        ) {

            const rectangle =
                normalizeRectangle(
                    textStartPdfX,
                    textStartPdfY,
                    pdfX,
                    pdfY
                );

            isDrawingTextBox = false;
            previewAnnotation = null;

            if (
                rectangle.width >= 20 &&
                rectangle.height >= 12
            ) {

                const annotation =
                    createTextAnnotation(
                        rectangle.x,
                        rectangle.y,
                        rectangle.width,
                        rectangle.height
                    );

                annotations.push(annotation);

                selectedAnnotation = annotation;
                activeTool = "select";

                updateToolButtons();
                updatePropertiesPanel();
            }

            drawAnnotations();

            return;
        }

        if (
            isDrawingCallout
        ) {

            isDrawingCallout = false;
            previewAnnotation = null;

            if (
                Math.abs(pdfX - calloutStartPdfX) >= 10 ||
                Math.abs(pdfY - calloutStartPdfY) >= 10
            ) {

                const annotation =
                    createCalloutAnnotation(
                        pdfX,
                        pdfY,
                        defaultCalloutWidth,
                        defaultCalloutHeight,
                        calloutStartPdfX,
                        calloutStartPdfY
                    );

                annotations.push(annotation);

                selectedAnnotation = annotation;
                activeTool = "select";

                updateToolButtons();
                updatePropertiesPanel();
            }

            drawAnnotations();

            return;
        }

        if (
            isDraggingLeader
        ) {
            isDraggingLeader = false;

            drawAnnotations();

            return;
        }

        if (
            isResizing
        ) {

            resizeSelectedRectangularAnnotation();

            isResizing = false;
            activeResizeHandle = null;

            drawAnnotations();

            return;
        }

        isDragging = false;
    }
);

annotationCanvas.addEventListener(
    "mouseleave",
    () => {

        isDragging = false;
        isResizing = false;
        isDraggingLeader = false;
        activeResizeHandle = null;
        isDrawingRectangle = false;
        isDrawingTextBox = false;
        isDrawingCallout = false;
        previewAnnotation = null;

        drawAnnotations();
    }
);

annotationCanvas.addEventListener(
    "click",
    (event) => {

        if (
            activeTool === "delete"
        ) {

            updatePointerPosition(event);

            const hit =
                hitTestAnnotation(
                    pdfX,
                    pdfY
                );

            if (!hit) {
                return;
            }

            annotations =
                annotations.filter(
                    annotation =>
                        annotation !== hit
                );

            if (
                selectedAnnotation === hit
            ) {
                selectedAnnotation = null;
            }

            updatePropertiesPanel();
            drawAnnotations();
        }
    }
);

/* **************************************************
   PAGE RENDERING

   renderPage() is the main drawing pipeline:
   1. Get the current PDF page
   2. Calculate scale
   3. Size both canvases to match the PDF viewport
   4. Render the PDF
   5. Redraw annotations over the PDF
   6. Refresh the toolbar/status UI
   ************************************************** */

async function renderPage() {

    if (
        !hasDocument()
    ) {
        return;
    }

    if (rendering) {
        return;
    }

    rendering = true;

    let viewport = null;
    let page = null;

    if (
        documentType === "pdf"
    ) {
        page =
            await pdf.getPage(currentPage);

        if (zoomMode === "fitPage") {

            scale =
                calculateFitPage(page);
        }

        else if (zoomMode === "fitWidth") {

            scale =
                calculateFitWidth(page);
        }

        viewport =
            page.getViewport({
                scale
            });
    }

    else if (
        documentType === "blank"
    ) {

        if (zoomMode === "fitPage") {

            scale =
                calculateFitPageFromSize(
                    blankPageWidth,
                    blankPageHeight
                );
        }

        else if (zoomMode === "fitWidth") {

            scale =
                calculateFitWidthFromSize(
                    blankPageWidth
                );
        }

        viewport = {
            width: blankPageWidth * scale,
            height: blankPageHeight * scale
        };
    }

    zoomDisplay.textContent =
        `${Math.round(scale * 100)}%`;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    annotationCanvas.width = viewport.width;
    annotationCanvas.height = viewport.height;

    canvasContainer.style.width =
        `${viewport.width}px`;

    canvasContainer.style.height =
        `${viewport.height}px`;

    if (
        documentType === "pdf"
    ) {

        await page.render({
            canvasContext: ctx,
            viewport
        }).promise;
    }

    else if (
        documentType === "blank"
    ) {

        ctx.fillStyle = "#ffffff";

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );
    }

    drawAnnotations();

    updateZoomButtons();
    updatePropertiesPanel();

    pageDisplay.textContent =
        `Page ${currentPage} / ${totalPages}`;

    statusBar.textContent =
        `Loaded: ${currentFileName} (page ${currentPage} of ${totalPages})`;

    prevBtn.disabled =
        currentPage <= 1;

    nextBtn.disabled =
        currentPage >= totalPages;

    rendering = false;
}
