## WHAT

Refine the Progress and Profile pages to fix layout, styling, and data presentation issues. This covers date formatting in the progress chart, button sizing, and removing the campaign logistics section from the profile page.

Files to change:
- [src/app/progress/page.tsx](src/app/progress/page.tsx)
- [src/app/(main)/profile/page.tsx](src/app/(main)/profile/page.tsx)

## HOW

### [src/app/progress/page.tsx](src/app/progress/page.tsx)

**Date format in tooltip/pop-up only**

formatTooltipDate(dateStr)
  • Parse dateStr into a Date object
  • Return formatted string with abbreviated month, day, AND day of week
  • Example: "May 12, MON"
  • Used ONLY in the Tooltip component's payload display

**X-axis labels**

  • Keep existing `formatDate` function unchanged — X-axis labels stay as "May 12"

### [src/app/(main)/profile/page.tsx](src/app/(main)/profile/page.tsx)

**Hero Header — remove subtitle (line ~143-145)**

  • Remove the "WEEKLY CAMPAIGN ASSIGNMENT" span element

**Quick-Add card — replace with new-recruit button (line ~256-259)**

  • Remove the "CREATE NEW EXERCISE SPEC" quick-add card section
  • Import `NewRecruitButton` from `@/app/components/new-recruit-button`
  • Render `<NewRecruitButton variant="compact" />` in the top-right corner of the hero header area

**Exercise containers — remove shadow (line ~192)**

  • Remove `shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]` from the assignment card className
  • Keep the border and background styling

**Exercise containers — width matching day selector (line ~187)**

  • Add `w-full` to the `profile-assignment-list` div so it spans the full width like the day selector

**Delete button — center X icon (line ~201-207)**

  • Add `flex items-center justify-center` to the delete button container
  • Ensure the material icon is vertically and horizontally centered

**Campaign Logistics — remove entirely (line ~262-280)**

  • Remove the entire `profile-campaign-logistics` section including the grid showing exercise counts per day

**Day selector — integrate logistics (line ~156-174)**

  • The day buttons already show the day label
  • Remove the separate logistics grid since it's being deleted

## WHY

The progress page date format is missing the day of week, making it harder to correlate workout dates with the Mon/Wed/Fri routine. The profile page has redundant logistics information in a separate grid that duplicates what's already in the day selector. The new-recruit button should be accessible from the profile page for quick user switching. The exercise containers and delete buttons need styling alignment with the rest of the app's button patterns.

## QUESTIONS

**For you to answer:**
  • Should the date format show the full day name ("Monday") or abbreviated ("MON")?
  • The new-recruit compact button is 48px square — is that the right size, or should it be smaller?
  • Should the "CURRENT ASSETS" icon and heading stay as-is, or does it need styling changes too?

**You can ask me:**
  • "How should the date format look — 'May 12, MON' or 'MON, May 12'?"
  • "Do you want the new-recruit button to be inline with the header title or in its own row?"
  • "Should the day selector buttons keep their current size or expand to fill more space?"

## CRITIQUES

  • The new-recruit button currently only has `compact` and `expanded` variants — the compact variant uses `bg-error` (red) which matches the requested style, but it might not have the same shadow/click behavior as other buttons in the app
  • Removing the campaign logistics grid means losing the quick overview of exercise counts per day — users will need to click each day to see the count. Consider adding a small count badge to the day selector buttons instead
  • The progress chart X-axis rotation at -45 degrees is unchanged — no overlap concern
  • The profile page has two separate flows for adding exercises (the add exercise panel and the quick-add card) — consolidating to just the new-recruit button removes the exercise creation flow entirely, which might be intentional but worth confirming
