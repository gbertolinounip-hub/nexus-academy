export type PdfTextAlign = "left" | "center" | "right";

export interface UnipPdfTextFieldSpec {
  page: number;
  x: number;
  y: number;
  width: number;
  size: number;
  minSize?: number;
  align?: PdfTextAlign;
}

export interface UnipPdfRectSpec {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UnipPdfLineFieldSpec {
  page: number;
  x: number;
  y: number;
  width: number;
  size: number;
}

export const UNIP_TCE_TEMPLATE_VERSION = "v1";
export const UNIP_TCE_TEMPLATE_PATH =
  "assets/templates/tce/tce-obrigatorio-unip-v1.pdf";
export const UNIP_TCE_PAGE_WIDTH = 595.32;
export const UNIP_TCE_PAGE_HEIGHT = 841.92;

export const UNIP_TCE_TEMPLATE_FIELDS = {
  concedingParty: {
    corporateName: { page: 0, x: 133, y: 656.4, width: 401, size: 10.5 },
    documentNumber: { page: 0, x: 188, y: 642.2, width: 346, size: 10.5 },
    address: { page: 0, x: 113, y: 628.0, width: 225, size: 10.5 },
    addressNumber: {
      page: 0,
      x: 359,
      y: 628.0,
      width: 54,
      size: 10.5,
      align: "center"
    },
    addressComplement: {
      page: 0,
      x: 462,
      y: 628.0,
      width: 72,
      size: 10.5
    },
    neighborhood: { page: 0, x: 93, y: 613.8, width: 118, size: 10.5 },
    city: { page: 0, x: 268, y: 613.8, width: 107, size: 10.5 },
    state: {
      page: 0,
      x: 398,
      y: 613.8,
      width: 38,
      size: 10.5,
      align: "center"
    },
    postalCode: { page: 0, x: 470, y: 613.8, width: 64, size: 10.5 },
    phoneAreaCode: {
      page: 0,
      x: 116,
      y: 599.5,
      width: 16,
      size: 10.5,
      align: "center"
    },
    phoneNumber: { page: 0, x: 140, y: 599.5, width: 121, size: 10.5 },
    email: { page: 0, x: 314, y: 599.5, width: 220, size: 10.5 },
    internshipLocation: { page: 0, x: 149, y: 585.2, width: 385, size: 10.5 },
    internshipAddress: { page: 0, x: 113, y: 570.9, width: 225, size: 10.5 },
    internshipAddressNumber: {
      page: 0,
      x: 359,
      y: 570.9,
      width: 54,
      size: 10.5,
      align: "center"
    },
    internshipAddressComplement: {
      page: 0,
      x: 462,
      y: 570.9,
      width: 72,
      size: 10.5
    },
    internshipNeighborhood: {
      page: 0,
      x: 93,
      y: 556.7,
      width: 118,
      size: 10.5
    },
    internshipCity: { page: 0, x: 268, y: 556.7, width: 107, size: 10.5 },
    internshipState: {
      page: 0,
      x: 398,
      y: 556.7,
      width: 38,
      size: 10.5,
      align: "center"
    },
    internshipPostalCode: {
      page: 0,
      x: 470,
      y: 556.7,
      width: 64,
      size: 10.5
    },
    internshipPhoneAreaCode: {
      page: 0,
      x: 116,
      y: 542.4,
      width: 16,
      size: 10.5,
      align: "center"
    },
    internshipPhoneNumber: {
      page: 0,
      x: 140,
      y: 542.4,
      width: 121,
      size: 10.5
    },
    internshipEmail: { page: 0, x: 314, y: 542.4, width: 220, size: 10.5 },
    responsibleName: { page: 0, x: 131, y: 528.1, width: 403, size: 10.5 },
    responsibleDocument: { page: 0, x: 167, y: 513.8, width: 110, size: 10.5 },
    professionalCouncil: { page: 0, x: 457, y: 513.8, width: 78, size: 9.6 }
  },
  student: {
    fullName: { page: 0, x: 93, y: 471.1, width: 441, size: 10.5 },
    registration: { page: 0, x: 78, y: 456.8, width: 203, size: 10.5 },
    campus: { page: 0, x: 360, y: 456.8, width: 174, size: 10.5 },
    courseName: { page: 0, x: 93, y: 442.5, width: 168, size: 10.5 },
    semesterLabel: { page: 0, x: 318, y: 442.5, width: 75, size: 10.5 },
    shift: { page: 0, x: 433, y: 442.5, width: 101, size: 10.5 },
    address: { page: 0, x: 113, y: 428.2, width: 225, size: 10.5 },
    addressNumber: {
      page: 0,
      x: 359,
      y: 428.2,
      width: 54,
      size: 10.5,
      align: "center"
    },
    addressComplement: {
      page: 0,
      x: 462,
      y: 428.2,
      width: 72,
      size: 10.5
    },
    neighborhood: { page: 0, x: 93, y: 413.9, width: 118, size: 10.5 },
    city: { page: 0, x: 268, y: 413.9, width: 107, size: 10.5 },
    state: {
      page: 0,
      x: 398,
      y: 413.9,
      width: 38,
      size: 10.5,
      align: "center"
    },
    postalCode: { page: 0, x: 470, y: 413.9, width: 64, size: 10.5 },
    phoneAreaCode: {
      page: 0,
      x: 116,
      y: 399.6,
      width: 16,
      size: 10.5,
      align: "center"
    },
    phoneNumber: { page: 0, x: 140, y: 399.6, width: 121, size: 10.5 },
    email: { page: 0, x: 314, y: 399.6, width: 220, size: 10.5 }
  },
  term: {
    rangeCover: { page: 1, x: 147, y: 727.4, width: 262, height: 18 },
    rangeText: { page: 1, x: 148, y: 731.6, width: 258, size: 10.5 },
    startsAtDay: { page: 1, x: 147, y: 731.6, width: 22, size: 10.5, align: "center" },
    startsAtMonth: { page: 1, x: 185, y: 731.6, width: 22, size: 10.5, align: "center" },
    startsAtYear: { page: 1, x: 220, y: 731.6, width: 34, size: 10.5, align: "center" },
    endsAtDay: { page: 1, x: 292, y: 731.6, width: 22, size: 10.5, align: "center" },
    endsAtMonth: { page: 1, x: 330, y: 731.6, width: 22, size: 10.5, align: "center" },
    endsAtYear: { page: 1, x: 366, y: 731.6, width: 34, size: 10.5, align: "center" }
  },
  schedule: {
    monday: {
      startTime: { page: 1, x: 226, y: 693.5, width: 34, size: 10.5, align: "center" },
      endTime: { page: 1, x: 279, y: 693.5, width: 44, size: 10.5, align: "center" },
      breakStartTime: { page: 1, x: 409, y: 693.5, width: 35, size: 10.5, align: "center" },
      breakEndTime: { page: 1, x: 462, y: 693.5, width: 44, size: 10.5, align: "center" }
    },
    tuesday: {
      startTime: { page: 1, x: 226, y: 679.2, width: 34, size: 10.5, align: "center" },
      endTime: { page: 1, x: 279, y: 679.2, width: 44, size: 10.5, align: "center" },
      breakStartTime: { page: 1, x: 409, y: 679.2, width: 35, size: 10.5, align: "center" },
      breakEndTime: { page: 1, x: 462, y: 679.2, width: 44, size: 10.5, align: "center" }
    },
    wednesday: {
      startTime: { page: 1, x: 226, y: 664.9, width: 34, size: 10.5, align: "center" },
      endTime: { page: 1, x: 279, y: 664.9, width: 44, size: 10.5, align: "center" },
      breakStartTime: { page: 1, x: 409, y: 664.9, width: 35, size: 10.5, align: "center" },
      breakEndTime: { page: 1, x: 462, y: 664.9, width: 44, size: 10.5, align: "center" }
    },
    thursday: {
      startTime: { page: 1, x: 226, y: 650.6, width: 34, size: 10.5, align: "center" },
      endTime: { page: 1, x: 279, y: 650.6, width: 44, size: 10.5, align: "center" },
      breakStartTime: { page: 1, x: 409, y: 650.6, width: 35, size: 10.5, align: "center" },
      breakEndTime: { page: 1, x: 462, y: 650.6, width: 44, size: 10.5, align: "center" }
    },
    friday: {
      startTime: { page: 1, x: 226, y: 636.3, width: 34, size: 10.5, align: "center" },
      endTime: { page: 1, x: 279, y: 636.3, width: 44, size: 10.5, align: "center" },
      breakStartTime: { page: 1, x: 409, y: 636.3, width: 35, size: 10.5, align: "center" },
      breakEndTime: { page: 1, x: 462, y: 636.3, width: 44, size: 10.5, align: "center" }
    },
    saturday: {
      startTime: { page: 1, x: 226, y: 621.9, width: 34, size: 10.5, align: "center" },
      endTime: { page: 1, x: 279, y: 621.9, width: 44, size: 10.5, align: "center" },
      breakStartTime: { page: 1, x: 409, y: 621.9, width: 35, size: 10.5, align: "center" },
      breakEndTime: { page: 1, x: 462, y: 621.9, width: 44, size: 10.5, align: "center" }
    }
  },
  workload: {
    daily: { page: 1, x: 191, y: 589.7, width: 54, size: 10.5, align: "center" },
    weekly: { page: 1, x: 416, y: 589.7, width: 88, size: 10.5, align: "center" }
  },
  activityPlanLines: [
    { page: 2, x: 55, y: 145.8, width: 468, size: 10.2 },
    { page: 2, x: 55, y: 129.5, width: 468, size: 10.2 },
    { page: 2, x: 55, y: 113.7, width: 468, size: 10.2 },
    { page: 2, x: 55, y: 97.9, width: 468, size: 10.2 },
    { page: 2, x: 55, y: 81.5, width: 468, size: 10.2 },
    { page: 2, x: 55, y: 65.7, width: 468, size: 10.2 },
    { page: 3, x: 55, y: 739.0, width: 468, size: 10.2 },
    { page: 3, x: 55, y: 722.7, width: 468, size: 10.2 },
    { page: 3, x: 55, y: 706.9, width: 468, size: 10.2 },
    { page: 3, x: 55, y: 691.0, width: 468, size: 10.2 }
  ],
  activityPlanContinuationPage: {
    clearBody: { page: 0, x: 42, y: 36, width: 512, height: 706 },
    title: {
      page: 0,
      x: 120,
      y: 738,
      width: 355,
      size: 14,
      align: "center"
    },
    subtitle: {
      page: 0,
      x: 150,
      y: 720,
      width: 295,
      size: 10,
      align: "center"
    },
    firstLineY: 686,
    lineSpacing: 18,
    linesPerPage: 29,
    lineX: 55,
    lineWidth: 468,
    lineStrokeOffset: 3.5
  },
  signatureLine: {
    cover: { page: 3, x: 187, y: 388, width: 224, height: 20 },
    text: { page: 3, x: 190, y: 396.1, width: 218, size: 10.5, align: "center" }
  },
  pageNumber: {
    cover: { page: 0, x: 500, y: 10, width: 54, height: 34 },
    text: {
      page: 0,
      x: 518,
      y: 22,
      width: 24,
      size: 10,
      align: "right"
    }
  }
} as const;
