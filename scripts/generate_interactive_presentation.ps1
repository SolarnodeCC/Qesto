$ErrorActionPreference = "Stop"

$outputPath = "C:\Users\gebruiker\Documents\GitHub\Qesto\docs\Qesto_Engineering_Interactive_Story.pptx"

$slides = @(
    @{
        Title = "From Idea to Edge Reliability"
        Body = @(
            "Goal: Frame reliability as an end-to-end engineering system."
            ""
            "On-click reveals:"
            "1) Product promise: real-time sessions with low latency."
            "2) Engineering challenge: multi-tenant, secure, edge-first."
            "3) Answer: five connected layers."
        )
        Notes = @(
            "Speaker flow:"
            "- This is not a platform tour; it is the operating system behind consistent releases."
            "- Every feature must pass through five layers before we trust it in production."
            ""
            "Audience question:"
            "Where does reliability usually break first in your team: code quality, process handoff, or operational control?"
        )
    },
    @{
        Title = "The 5-Layer System Map"
        Body = @(
            "Goal: Introduce architecture and delivery in one visual."
            ""
            "On-click reveals:"
            "1) Technical Environment"
            "2) Workforce and Runtime Actors"
            "3) Agents, Skills, Markdown"
            "4) Automation Layer"
            "5) Control Layer"
        )
        Notes = @(
            "Speaker flow:"
            "- Each upper layer fails if lower layers are weak."
            "- Velocity comes from automation; safety comes from controls."
            ""
            "Audience question:"
            "Which layer is usually missing in architecture presentations at your company?"
        )
    },
    @{
        Title = "Technical Environment: Build to Edge Execution"
        Body = @(
            "Goal: Show path from local code to runtime behavior."
            ""
            "On-click reveals:"
            "1) Cursor + AI-assisted implementation."
            "2) GitHub PR checks and review."
            "3) Cloudflare Pages Functions + Durable Objects + D1/KV."
            "4) Edge execution + observability feedback."
        )
        Notes = @(
            "Speaker flow:"
            "- Typed boundaries prevent contract drift."
            "- PR checks validate correctness before merge."
            "- Telemetry closes the loop and informs hardening."
            ""
            "Audience question:"
            "Do you treat observability as the end of delivery, or part of development?"
        )
    },
    @{
        Title = "Workforce and Runtime Ownership Model"
        Body = @(
            "Goal: Make accountability explicit across humans and machine actors."
            ""
            "On-click reveals:"
            "1) Human owners: Product, Engineer, Reviewer, Security, DevOps/On-call."
            "2) Machine actors: CI runners, edge workers, Durable Objects, scanners."
            "3) Handoff chain: backlog -> implementation -> review -> release -> incident ownership."
        )
        Notes = @(
            "Speaker flow:"
            "- Tooling does not remove ownership; it sharpens it."
            "- No unlabeled handoffs."
            ""
            "Audience question:"
            "Where do handoffs currently lose context in your flow?"
        )
    },
    @{
        Title = "Agents, Skills, and Markdown Control Plane"
        Body = @(
            "Goal: Show AI acceleration with governance boundaries."
            ""
            "On-click reveals:"
            "1) Main agent vs specialist subagents."
            "2) Skills as reusable operating playbooks."
            "3) Markdown as durable policy interface."
            "4) Human review remains merge authority."
        )
        Notes = @(
            "Speaker flow:"
            "- AI accelerates execution, markdown defines boundaries."
            "- Specialist agents reduce context switching."
            ""
            "Audience question:"
            "What guardrails must exist before AI-generated changes can merge?"
        )
    },
    @{
        Title = "Automation Layer: Deterministic Delivery"
        Body = @(
            "Goal: Explain how automation creates speed with trust."
            ""
            "On-click reveals:"
            "1) Triggers: PR, push, scheduled jobs."
            "2) Checks: lint, type-check, tests, coverage, drift, security."
            "3) Gates: pass/fail promotion behavior."
            "4) Artifacts: logs and trend evidence."
        )
        Notes = @(
            "Speaker flow:"
            "- Automation is only useful when deterministic."
            "- Pipeline is a gatekeeper, not only a dashboard."
            ""
            "Audience question:"
            "Are your CI signals decision-grade evidence or green/red noise?"
        )
    },
    @{
        Title = "Control Layer: Prevent, Detect, Correct"
        Body = @(
            "Goal: Position controls as engineering enablers."
            ""
            "On-click reveals:"
            "1) Preventive: RBAC, branch protections, secrets hygiene."
            "2) Detective: scans, metrics, alerts, audit trail."
            "3) Corrective: rollback, hotfix, postmortem hardening."
        )
        Notes = @(
            "Speaker flow:"
            "- Controls enable speed at scale."
            "- Recovery speed is as important as prevention."
            ""
            "Audience question:"
            "If a severe issue ships today, how quickly do you get reliable signal?"
        )
    },
    @{
        Title = "Testing Strategy: Confidence Pipeline"
        Body = @(
            "Goal: Present testing as staged confidence, not one gate."
            ""
            "On-click reveals:"
            "1) Static validation (lint/type/format)."
            "2) Unit tests (fast module confidence)."
            "3) Integration tests (cross-boundary behavior)."
            "4) Stability guard (flaky detection/quarantine)."
            "5) Post-merge runtime validation."
        )
        Notes = @(
            "Speaker flow:"
            "- Fast tests protect developer flow."
            "- Deep tests protect release integrity."
            ""
            "Audience question:"
            "Which stage currently adds most false confidence in your pipeline?"
        )
    },
    @{
        Title = "Vitest Deep Dive: Core Quality Signal"
        Body = @(
            "Goal: Show how Vitest drives merge and release decisions."
            ""
            "On-click reveals:"
            "1) Authoring: tests evolve with code."
            "2) Local run: immediate regression signal."
            "3) CI run: standardized gate behavior."
            "4) Triage: regression vs flaky classification."
            "5) Learning: incidents become permanent tests."
        )
        Notes = @(
            "Speaker flow:"
            "- Vitest is a decision system, not only a test runner."
            "- Optimize for fast local feedback + deterministic CI."
            ""
            "Audience question:"
            "What share of failing tests are actionable regressions vs unstable behavior?"
        )
    },
    @{
        Title = "Vitest Failure Triage Playbook"
        Body = @(
            "Goal: Make failure response operational and repeatable."
            ""
            "On-click reveals:"
            "1) Classify fail: regression, test bug, environment issue, flake."
            "2) Assign owner and fix window."
            "3) Decide: patch now, quarantine, or block release."
            "4) Update suite and policy after resolution."
        )
        Notes = @(
            "Speaker flow:"
            "- Failed tests without owners become organizational debt."
            "- Resolution must improve future signal quality."
            ""
            "Audience question:"
            "Who owns flaky test debt, and what SLA is applied?"
        )
    },
    @{
        Title = "10-Round Engineering Completeness Review"
        Body = @(
            "Goal: Demonstrate rigor beyond architecture diagrams."
            ""
            "On-click reveals:"
            "1) Boundaries and topology."
            "2) Execution path and determinism."
            "3) Ownership and governance."
            "4) Observability and resilience."
            "5) Coverage sweep + watch items."
        )
        Notes = @(
            "Speaker flow:"
            "- Pass does not mean done; each round adds watch items."
            "- Quarterly revalidation keeps design and reality aligned."
            ""
            "Audience question:"
            "How often do you formally revalidate architecture using incident evidence?"
        )
    },
    @{
        Title = "Engineering Scorecard and Next Quarter"
        Body = @(
            "Goal: End with measurable outcomes and next actions."
            ""
            "On-click reveals:"
            "1) Core KPIs: lead time, deploy frequency, change-failure rate, MTTR."
            "2) Test KPIs: pass trend, flaky trend, mean time to fix failures."
            "3) Control KPIs: policy violations, alert precision, rollback speed."
            "4) Next 90 days: top 3 hardening priorities."
        )
        Notes = @(
            "Speaker flow:"
            "- Reliability becomes real when attached to metrics."
            "- Next quarter focuses on reducing variability."
            ""
            "Audience question:"
            "If you could improve one KPI next quarter, which most increases customer trust?"
        )
    }
)

$pp = New-Object -ComObject PowerPoint.Application
$pp.Visible = -1
$presentation = $pp.Presentations.Add()

# 16:9 widescreen
$presentation.PageSetup.SlideSize = 16

function Set-TextStyle($shape, $fontName, $fontSize, $isBold) {
    $shape.TextFrame.TextRange.Font.Name = $fontName
    $shape.TextFrame.TextRange.Font.Size = $fontSize
    $shape.TextFrame.TextRange.Font.Bold = [int]($isBold)
}

function Get-SectionName($index) {
    if ($index -le 2) { return "System Narrative" }
    if ($index -le 4) { return "Environment & Ownership" }
    if ($index -le 7) { return "Automation & Control" }
    if ($index -le 10) { return "Testing & Vitest" }
    return "Review & Scorecard"
}

function Get-SectionColor($index) {
    if ($index -le 2) { return 1253790 }   # dark blue
    if ($index -le 4) { return 9784575 }   # teal
    if ($index -le 7) { return 10510116 }  # violet
    if ($index -le 10) { return 4967430 }  # orange
    return 6974058                         # green
}

function Apply-VisualChrome($slide, $index) {
    $sectionColor = Get-SectionColor $index
    $sectionName = Get-SectionName $index

    # White background for visual consistency
    $slide.FollowMasterBackground = $false
    $slide.Background.Fill.Solid()
    $slide.Background.Fill.ForeColor.RGB = 16777215

    # Top strip
    $topBar = $slide.Shapes.AddShape(1, 0, 0, 1280, 34)
    $topBar.Fill.Solid()
    $topBar.Fill.ForeColor.RGB = $sectionColor
    $topBar.Line.Visible = 0

    # Section label
    $sectionTag = $slide.Shapes.AddTextbox(1, 28, 6, 360, 20)
    $sectionTag.TextFrame.TextRange.Text = $sectionName
    $sectionTag.TextFrame.TextRange.Font.Name = "Aptos"
    $sectionTag.TextFrame.TextRange.Font.Size = 12
    $sectionTag.TextFrame.TextRange.Font.Bold = 1
    $sectionTag.TextFrame.TextRange.Font.Color.RGB = 16777215
    $sectionTag.Line.Visible = 0

    # Left accent rail
    $leftRail = $slide.Shapes.AddShape(1, 0, 34, 8, 686)
    $leftRail.Fill.Solid()
    $leftRail.Fill.ForeColor.RGB = $sectionColor
    $leftRail.Line.Visible = 0
}

$slideIndex = 1
foreach ($s in $slides) {
    if ($slideIndex -eq 1) {
        $slide = $presentation.Slides.Add($slideIndex, 1) # ppLayoutTitle
        Apply-VisualChrome $slide $slideIndex
        $slide.Shapes.Title.TextFrame.TextRange.Text = $s.Title
        Set-TextStyle $slide.Shapes.Title "Aptos Display" 42 $true
        $slide.Shapes.Title.Top = 88
        $slide.Shapes.Title.Left = 56
        $slide.Shapes.Title.Width = 1150

        $subtitle = $slide.Shapes.Placeholders.Item(2)
        $subtitle.TextFrame.TextRange.Text = ($s.Body -join "`r`n")
        Set-TextStyle $subtitle "Aptos" 19 $false
        $subtitle.Top = 210
        $subtitle.Left = 56
        $subtitle.Width = 1130
    } else {
        $slide = $presentation.Slides.Add($slideIndex, 2) # ppLayoutText
        Apply-VisualChrome $slide $slideIndex
        $slide.Shapes.Title.TextFrame.TextRange.Text = $s.Title
        Set-TextStyle $slide.Shapes.Title "Aptos Display" 34 $true
        $slide.Shapes.Title.Top = 72
        $slide.Shapes.Title.Left = 56
        $slide.Shapes.Title.Width = 1150

        $content = $slide.Shapes.Placeholders.Item(2)
        $content.TextFrame.TextRange.Text = ($s.Body -join "`r`n")
        Set-TextStyle $content "Aptos" 20 $false
        $content.Top = 170
        $content.Left = 56
        $content.Width = 1120
    }

    # Speaker notes
    $notesShape = $slide.NotesPage.Shapes.Placeholders.Item(2)
    $notesShape.TextFrame.TextRange.Text = ($s.Notes -join "`r`n")
    $notesShape.TextFrame.TextRange.Font.Name = "Aptos"
    $notesShape.TextFrame.TextRange.Font.Size = 14

    # Footer tag
    $tag = $slide.Shapes.AddTextbox(1, 760, 688, 500, 24)
    $tag.TextFrame.TextRange.Text = "Qesto Engineering Story - Interactive Draft"
    $tag.TextFrame.TextRange.Font.Name = "Aptos"
    $tag.TextFrame.TextRange.Font.Size = 11
    $tag.TextFrame.TextRange.Font.Color.RGB = 8421504
    $tag.Line.Visible = 0

    $slideIndex++
}

if (Test-Path $outputPath) {
    Remove-Item $outputPath -Force
}

$presentation.SaveAs($outputPath)
$presentation.Close()
$pp.Quit()

Write-Output "Created: $outputPath"
