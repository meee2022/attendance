import { describe, it, expect } from "vitest";
import { mainRecommendations } from "../src/pages/visits/MonthlyReport";

describe("monthly report", () => {
    it("keeps what is to be done and drops thanks, closings and «أوصي بـ»", () => {
        expect(mainRecommendations({
            planningRec: "على المعلم توفير خطة الدرس أثناء الحصة.",
            executionRec: "أشكر المعلم على جهوده وأوصي بـ:\n- تقليل زمن تحدث المعلم.\n- تقليل زمن تحدث المعلم.",
            evalMgmtRec: "", managementRec: "", notes: "يرجى العمل وفق التوصيات أعلاه.",
        })).toBe("على المعلم توفير خطة الدرس أثناء الحصة؛ تقليل زمن تحدث المعلم");
    });
});
