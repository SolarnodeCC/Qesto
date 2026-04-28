$ErrorActionPreference = "Stop"

$outputPath = "C:\Users\gebruiker\Documents\GitHub\Qesto\docs\Qesto_Engineering_Interactive_Story_v3.pptx"

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
        Workflow = @("Idea", "Code", "Verify", "Deploy", "Observe", "Improve")
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
        Workflow = @("Environment", "Workforce", "Agents", "Automation", "Control")
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
        Workflow = @("Local Dev", "PR", "CI", "Cloudflare Deploy", "Edge Runtime", "Telemetry")
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
        Workflow = @("Backlog", "Owner Assigned", "Implement", "Review", "Release", "On-call")
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
        Workflow = @("Task Intake", "Agent Routing", "Skill Constraints", "Code/Docs Output", "Human Review")
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
        Workflow = @("Trigger", "Checks", "Artifacts", "Gate Decision", "Promote/Block")
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
        Workflow = @("Prevent", "Detect", "Respond", "Recover", "Harden")
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
        Workflow = @("Static", "Unit", "Integration", "Stability Guard", "Runtime Validation")
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
        Workflow = @("Write Test", "Local Run", "CI Run", "Triage", "Fix", "Regression Proof")
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
        Workflow = @("Fail Detected", "Classify", "Assign Owner", "Patch/Quarantine", "Policy Update")
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
        Workflow = @("Round 1-3", "Round 4-6", "Round 7-8", "Round 9", "Round 10", "Action Plan")
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
        Workflow = @("Measure", "Compare", "Prioritize", "Execute", "Review")
    }
)

function Add-FullSystemFlowchartSlide($presentation) {
    $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 12) # ppLayoutBlank
    $slide.FollowMasterBackground = $false
    $slide.Background.Fill.Solid()
    $slide.Background.Fill.ForeColor.RGB = 16777215

    # Title
    $title = $slide.Shapes.AddTextbox(1, 34, 16, 1210, 40)
    $title.TextFrame.TextRange.Text = "Full 5-Layer Workflow Diagram: Trigger to Controlled Outcome"
    $title.TextFrame.TextRange.Font.Name = "Aptos Display"
    $title.TextFrame.TextRange.Font.Size = 24
    $title.TextFrame.TextRange.Font.Bold = 1
    $title.Line.Visible = 0

    # Start / End
    $start = $slide.Shapes.AddShape(9, 20, 88, 180, 52) # oval
    $start.Fill.Solid()
    $start.Fill.ForeColor.RGB = 14483456
    $start.Line.ForeColor.RGB = 11393254
    $start.TextFrame.TextRange.Text = "Trigger"
    $start.TextFrame.TextRange.Font.Name = "Aptos"
    $start.TextFrame.TextRange.Font.Size = 12
    $start.TextFrame.TextRange.Font.Bold = 1
    $start.TextFrame.TextRange.ParagraphFormat.Alignment = 2

    $end = $slide.Shapes.AddShape(9, 1080, 650, 180, 48)
    $end.Fill.Solid()
    $end.Fill.ForeColor.RGB = 14540253
    $end.Line.ForeColor.RGB = 9689371
    $end.TextFrame.TextRange.Text = "Final Action"
    $end.TextFrame.TextRange.Font.Name = "Aptos"
    $end.TextFrame.TextRange.Font.Size = 12
    $end.TextFrame.TextRange.Font.Bold = 1
    $end.TextFrame.TextRange.ParagraphFormat.Alignment = 2

    # Lane helper
    function Add-Lane($slideObj, $top, $height, $name, $color) {
        $lane = $slideObj.Shapes.AddShape(1, 30, $top, 1220, $height)
        $lane.Fill.Solid()
        $lane.Fill.ForeColor.RGB = 16316664
        $lane.Line.ForeColor.RGB = $color
        $lane.Line.Weight = 1.2
        $label = $slideObj.Shapes.AddTextbox(1, 38, $top + 4, 320, 16)
        $label.TextFrame.TextRange.Text = $name
        $label.TextFrame.TextRange.Font.Name = "Aptos"
        $label.TextFrame.TextRange.Font.Size = 11
        $label.TextFrame.TextRange.Font.Bold = 1
        $label.TextFrame.TextRange.Font.Color.RGB = $color
        $label.Line.Visible = 0
    }

    Add-Lane $slide 78 102 "1) Technical Environment" 1253790
    Add-Lane $slide 186 102 "2) Workforce & Runtime Actors" 9784575
    Add-Lane $slide 294 102 "3) Agents, Skills, Markdown" 10510116
    Add-Lane $slide 402 102 "4) Automation Layer" 4967430
    Add-Lane $slide 510 102 "5) Control Layer" 6974058

    function Add-Step($slideObj, $left, $top, $text, $fillColor) {
        $shape = $slideObj.Shapes.AddShape(1, $left, $top, 170, 62)
        $shape.Fill.Solid()
        $shape.Fill.ForeColor.RGB = $fillColor
        $shape.Line.ForeColor.RGB = 16777215
        $shape.TextFrame.TextRange.Text = $text
        $shape.TextFrame.TextRange.Font.Name = "Aptos"
        $shape.TextFrame.TextRange.Font.Size = 9
        $shape.TextFrame.TextRange.Font.Bold = 1
        $shape.TextFrame.TextRange.Font.Color.RGB = 16777215
        $shape.TextFrame.TextRange.ParagraphFormat.Alignment = 2
        $shape.TextFrame.VerticalAnchor = 3
        return $shape
    }

    # Lane 1
    $t1 = Add-Step $slide 230 98 "Local implementation`nsrc/*, functions/api/*, worker/*" 1253790
    $t2 = Add-Step $slide 420 98 "GitHub PR`nPOST /repos/.../pulls" 1253790
    $t3 = Add-Step $slide 610 98 "Cloudflare deploy`nPOST /.../deployments" 1253790
    $td = $slide.Shapes.AddShape(4, 815, 100, 86, 58) # diamond
    $td.Fill.Solid(); $td.Fill.ForeColor.RGB = 1253790; $td.Line.ForeColor.RGB = 16777215
    $td.TextFrame.TextRange.Text = "Healthy?"
    $td.TextFrame.TextRange.Font.Name = "Aptos"; $td.TextFrame.TextRange.Font.Size = 10; $td.TextFrame.TextRange.Font.Bold = 1; $td.TextFrame.TextRange.Font.Color.RGB = 16777215
    $td.TextFrame.TextRange.ParagraphFormat.Alignment = 2

    # Lane 2
    $w1 = Add-Step $slide 900 206 "Ownership routing`nGET /api/backlog" 9784575
    $w2 = Add-Step $slide 1090 206 "Runtime execution`nPOST /api/sessions`nWS /api/realtime/{id}" 9784575

    # Lane 3
    $g1 = Add-Step $slide 230 314 "Task intake`nPOST /agent/tasks" 10510116
    $g2 = Add-Step $slide 420 314 "Skill/policy load`nGET /docs/spec/*" 10510116
    $g3 = Add-Step $slide 610 314 "Artifact output`nPUT /repos/.../contents/{path}" 10510116
    $gd = $slide.Shapes.AddShape(4, 815, 316, 96, 58)
    $gd.Fill.Solid(); $gd.Fill.ForeColor.RGB = 10510116; $gd.Line.ForeColor.RGB = 16777215
    $gd.TextFrame.TextRange.Text = "Approved?"
    $gd.TextFrame.TextRange.Font.Name = "Aptos"; $gd.TextFrame.TextRange.Font.Size = 10; $gd.TextFrame.TextRange.Font.Bold = 1; $gd.TextFrame.TextRange.Font.Color.RGB = 16777215
    $gd.TextFrame.TextRange.ParagraphFormat.Alignment = 2

    # Lane 4
    $a1 = Add-Step $slide 920 422 "CI trigger`nPOST /repos/.../dispatches" 4967430
    $a2 = Add-Step $slide 1110 422 "Quality gates`nGET /repos/.../runs/{id}" 4967430
    $ad = $slide.Shapes.AddShape(4, 1110, 494, 96, 58)
    $ad.Fill.Solid(); $ad.Fill.ForeColor.RGB = 4967430; $ad.Line.ForeColor.RGB = 16777215
    $ad.TextFrame.TextRange.Text = "All pass?"
    $ad.TextFrame.TextRange.Font.Name = "Aptos"; $ad.TextFrame.TextRange.Font.Size = 10; $ad.TextFrame.TextRange.Font.Bold = 1; $ad.TextFrame.TextRange.Font.Color.RGB = 16777215
    $ad.TextFrame.TextRange.ParagraphFormat.Alignment = 2

    # Lane 5
    $c1 = Add-Step $slide 230 530 "Preventive`nRBAC / branch protection" 6974058
    $c2 = Add-Step $slide 420 530 "Detective`nlogs / metrics / alerts" 6974058
    $c3 = Add-Step $slide 610 530 "Corrective`nrollback / incident" 6974058

    function Add-Arrow($slideObj, $x, $y, $w, $h, $color) {
        $arrow = $slideObj.Shapes.AddShape(33, $x, $y, $w, $h)
        $arrow.Fill.Solid()
        $arrow.Fill.ForeColor.RGB = $color
        $arrow.Line.Visible = 0
    }

    # Main arrows
    Add-Arrow $slide 402 122 16 12 1253790
    Add-Arrow $slide 592 122 16 12 1253790
    Add-Arrow $slide 785 122 24 12 1253790
    Add-Arrow $slide 892 230 12 16 9784575
    Add-Arrow $slide 1082 230 12 16 9784575
    Add-Arrow $slide 402 338 16 12 10510116
    Add-Arrow $slide 592 338 16 12 10510116
    Add-Arrow $slide 785 338 24 12 10510116
    Add-Arrow $slide 1102 446 12 16 4967430
    Add-Arrow $slide 1102 518 12 16 4967430
    Add-Arrow $slide 402 554 16 12 6974058
    Add-Arrow $slide 592 554 16 12 6974058

    # Feedback labels and loops (textual hints for clarity)
    $fb1 = $slide.Shapes.AddTextbox(1, 920, 610, 320, 20)
    $fb1.TextFrame.TextRange.Text = "Feedback: observability -> implementation"
    $fb1.TextFrame.TextRange.Font.Name = "Aptos"; $fb1.TextFrame.TextRange.Font.Size = 10; $fb1.TextFrame.TextRange.Font.Color.RGB = 8421504
    $fb1.Line.Visible = 0

    $fb2 = $slide.Shapes.AddTextbox(1, 920, 630, 320, 20)
    $fb2.TextFrame.TextRange.Text = "Failure loop: corrective -> agent task intake"
    $fb2.TextFrame.TextRange.Font.Name = "Aptos"; $fb2.TextFrame.TextRange.Font.Size = 10; $fb2.TextFrame.TextRange.Font.Color.RGB = 8421504
    $fb2.Line.Visible = 0

    # End connector arrow
    Add-Arrow $slide 980 668 90 12 6974058
}

function Add-TopicFlowchartSlide($presentation, $title, $trigger, $steps, $finalAction, $color) {
    $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 12) # blank
    $slide.FollowMasterBackground = $false
    $slide.Background.Fill.Solid()
    $slide.Background.Fill.ForeColor.RGB = 16777215

    $header = $slide.Shapes.AddTextbox(1, 28, 14, 1220, 38)
    $header.TextFrame.TextRange.Text = "Flowchart - $title"
    $header.TextFrame.TextRange.Font.Name = "Aptos Display"
    $header.TextFrame.TextRange.Font.Size = 24
    $header.TextFrame.TextRange.Font.Bold = 1
    $header.Line.Visible = 0

    # visual rail
    $bar = $slide.Shapes.AddShape(1, 0, 64, 1280, 6)
    $bar.Fill.Solid()
    $bar.Fill.ForeColor.RGB = $color
    $bar.Line.Visible = 0

    # start
    $start = $slide.Shapes.AddShape(9, 70, 100, 230, 62)
    $start.Fill.Solid()
    $start.Fill.ForeColor.RGB = 15132390
    $start.Line.ForeColor.RGB = $color
    $start.TextFrame.TextRange.Text = "Trigger`n$trigger"
    $start.TextFrame.TextRange.Font.Name = "Aptos"
    $start.TextFrame.TextRange.Font.Size = 11
    $start.TextFrame.TextRange.Font.Bold = 1
    $start.TextFrame.TextRange.ParagraphFormat.Alignment = 2
    $start.TextFrame.VerticalAnchor = 3

    $x = 70
    $y = 210
    $stepH = 92
    $gap = 22

    foreach ($st in $steps) {
        $box = $slide.Shapes.AddShape(1, $x, $y, 1140, $stepH)
        $box.Fill.Solid()
        $box.Fill.ForeColor.RGB = 16316664
        $box.Line.ForeColor.RGB = $color
        $box.Line.Weight = 1.25
        $box.TextFrame.TextRange.Text = "$($st.Step)`nPurpose: $($st.Description)`nEndpoint examples: $($st.Endpoints)"
        $box.TextFrame.TextRange.Font.Name = "Aptos"
        $box.TextFrame.TextRange.Font.Size = 11
        $box.TextFrame.TextRange.Font.Bold = 0
        $box.TextFrame.TextRange.ParagraphFormat.Alignment = 1
        $box.TextFrame.VerticalAnchor = 3

        if ($y -gt 210) {
            $arrow = $slide.Shapes.AddShape(33, 610, $y - 14, 34, 12)
            $arrow.Fill.Solid()
            $arrow.Fill.ForeColor.RGB = $color
            $arrow.Line.Visible = 0
        }

        $y += ($stepH + $gap)
    }

    # arrow from start to step 1
    $startArrow = $slide.Shapes.AddShape(33, 305, 125, 180, 14)
    $startArrow.Fill.Solid()
    $startArrow.Fill.ForeColor.RGB = $color
    $startArrow.Line.Visible = 0

    # end
    $end = $slide.Shapes.AddShape(9, 470, 658, 340, 44)
    $end.Fill.Solid()
    $end.Fill.ForeColor.RGB = 14540253
    $end.Line.ForeColor.RGB = $color
    $end.TextFrame.TextRange.Text = "Final Action: $finalAction"
    $end.TextFrame.TextRange.Font.Name = "Aptos"
    $end.TextFrame.TextRange.Font.Size = 12
    $end.TextFrame.TextRange.Font.Bold = 1
    $end.TextFrame.TextRange.ParagraphFormat.Alignment = 2
    $end.TextFrame.VerticalAnchor = 3

    $toEnd = $slide.Shapes.AddShape(33, 610, 630, 34, 12)
    $toEnd.Fill.Solid()
    $toEnd.Fill.ForeColor.RGB = $color
    $toEnd.Line.Visible = 0
}

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

function Add-WorkflowDiagram($slide, $steps, $index) {
    if ($null -eq $steps -or $steps.Count -eq 0) { return }

    $sectionColor = Get-SectionColor $index
    $startX = 56
    $y = 548
    $boxW = 180
    $boxH = 58
    $gap = 26
    $maxSteps = [Math]::Min($steps.Count, 6)

    # Dedicated panel so workflow is unmistakable
    $panel = $slide.Shapes.AddShape(1, 44, 500, 1190, 130)
    $panel.Fill.Solid()
    $panel.Fill.ForeColor.RGB = 15132390
    $panel.Line.ForeColor.RGB = $sectionColor
    $panel.Line.Weight = 1.75

    $label = $slide.Shapes.AddTextbox(1, $startX, $y - 30, 360, 20)
    $label.TextFrame.TextRange.Text = "Workflow Diagram"
    $label.TextFrame.TextRange.Font.Name = "Aptos"
    $label.TextFrame.TextRange.Font.Size = 13
    $label.TextFrame.TextRange.Font.Bold = 1
    $label.TextFrame.TextRange.Font.Color.RGB = $sectionColor
    $label.Line.Visible = 0

    for ($i = 0; $i -lt $maxSteps; $i++) {
        $x = $startX + ($i * ($boxW + $gap))

        $box = $slide.Shapes.AddShape(1, $x, $y, $boxW, $boxH)
        $box.Fill.Solid()
        $box.Fill.ForeColor.RGB = $sectionColor
        $box.Line.ForeColor.RGB = 16777215
        $box.Line.Weight = 0.75
        $box.TextFrame.TextRange.Text = [string]$steps[$i]
        $box.TextFrame.TextRange.Font.Name = "Aptos"
        $box.TextFrame.TextRange.Font.Size = 13
        $box.TextFrame.TextRange.Font.Bold = 1
        $box.TextFrame.TextRange.Font.Color.RGB = 16777215
        $box.TextFrame.TextRange.ParagraphFormat.Alignment = 2
        $box.TextFrame.VerticalAnchor = 3

        if ($i -lt ($maxSteps - 1)) {
            $arrowX = $x + $boxW + 4
            $arrow = $slide.Shapes.AddShape(33, $arrowX, $y + 22, $gap - 8, 14)
            $arrow.Fill.Solid()
            $arrow.Fill.ForeColor.RGB = $sectionColor
            $arrow.Line.Visible = 0
        }
    }
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

    Add-WorkflowDiagram $slide $s.Workflow $slideIndex

    $slideIndex++
}

Add-FullSystemFlowchartSlide $presentation

$technicalSteps = @(
    @{ Step = "Step 1: Local Implementation"; Description = "Engineer updates typed frontend/API/worker modules."; Endpoints = "src/*, functions/api/*, worker/*" },
    @{ Step = "Step 2: Pull Request"; Description = "Changes are packaged with review context and checks."; Endpoints = "POST /repos/{owner}/{repo}/pulls" },
    @{ Step = "Step 3: Edge Deployment"; Description = "Candidate release is deployed to Cloudflare edge."; Endpoints = "POST /client/v4/accounts/{id}/pages/projects/{project}/deployments" },
    @{ Step = "Step 4: Runtime Validation"; Description = "Health and telemetry confirm safe production behavior."; Endpoints = "GET /api/observability/metrics, GET /api/observability/logs" }
)
Add-TopicFlowchartSlide $presentation "Technical Environment" "Feature request or code change accepted into implementation queue" $technicalSteps "Stable edge execution with observability feedback loop" 1253790

$workforceSteps = @(
    @{ Step = "Step 1: Ownership Routing"; Description = "Work item gets product, engineering, and review owners."; Endpoints = "GET /api/backlog, PATCH /api/stories/{id}" },
    @{ Step = "Step 2: Runtime Actor Mapping"; Description = "CI runners and runtime workers are assigned workload responsibilities."; Endpoints = "POST /api/sessions, WS /api/realtime/{roomId}" },
    @{ Step = "Step 3: Approval Handoff"; Description = "Reviewer and release owner approve progression criteria."; Endpoints = "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge" },
    @{ Step = "Step 4: Operational Ownership"; Description = "On-call team receives post-release accountability."; Endpoints = "POST /api/incidents, GET /api/observability/alerts" }
)
Add-TopicFlowchartSlide $presentation "Workforce & Runtime Actors" "Backlog item enters delivery pipeline" $workforceSteps "Clear accountability from planning to operations" 9784575

$agentSteps = @(
    @{ Step = "Step 1: Task Intake"; Description = "Main agent receives scoped objective and constraints."; Endpoints = "POST /agent/tasks" },
    @{ Step = "Step 2: Subagent Delegation"; Description = "Domain-specific subtasks are routed to specialists."; Endpoints = "POST /agent/subtasks" },
    @{ Step = "Step 3: Skill + Rule Loading"; Description = "Skill packs and markdown policies constrain execution."; Endpoints = "GET /docs/spec/*, GET /AGENTS.md" },
    @{ Step = "Step 4: Artifact Production"; Description = "Code, tests, and docs are generated and prepared for review."; Endpoints = "PUT /repos/{owner}/{repo}/contents/{path}" }
)
Add-TopicFlowchartSlide $presentation "Agents, Skills, Markdown" "Engineering task requires AI-assisted delivery" $agentSteps "Governed AI output accepted through human review" 10510116

$automationSteps = @(
    @{ Step = "Step 1: CI Trigger"; Description = "Push/PR/schedule starts deterministic automation run."; Endpoints = "POST /repos/{owner}/{repo}/actions/workflows/{id}/dispatches" },
    @{ Step = "Step 2: Quality Gates"; Description = "Lint, type-check, tests, coverage, and scans are executed."; Endpoints = "GET /repos/{owner}/{repo}/actions/runs/{run_id}" },
    @{ Step = "Step 3: Gate Decision"; Description = "Pipeline evaluates pass/fail and blocks or promotes release."; Endpoints = "GET /repos/{owner}/{repo}/check-runs/{id}" },
    @{ Step = "Step 4: Promotion"; Description = "Passing build merges and deploys with controlled rollout."; Endpoints = "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge" }
)
Add-TopicFlowchartSlide $presentation "Automation Layer" "Repository event or scheduled quality run" $automationSteps "Only validated changes reach production" 4967430

$controlSteps = @(
    @{ Step = "Step 1: Preventive Controls"; Description = "RBAC, branch protections, and secret policy reduce risk up front."; Endpoints = "GET /api/auth/me, POST /api/middleware/rbac/check" },
    @{ Step = "Step 2: Detective Controls"; Description = "Observability and audit trails detect drift and incidents early."; Endpoints = "GET /api/observability/logs, GET /api/observability/metrics" },
    @{ Step = "Step 3: Corrective Controls"; Description = "Rollback and hotfix actions restore service reliability."; Endpoints = "POST /api/deploy/rollback, POST /api/incidents" },
    @{ Step = "Step 4: Learning Loop"; Description = "Postmortem outcomes update runbooks, tests, and policy."; Endpoints = "PATCH /api/runbooks/{id}, PUT /repos/{owner}/{repo}/contents/{path}" }
)
Add-TopicFlowchartSlide $presentation "Control Layer" "Policy violation, anomaly, or incident signal detected" $controlSteps "System resilience improves through controlled remediation" 6974058

if (Test-Path $outputPath) {
    Remove-Item $outputPath -Force
}

$presentation.SaveAs($outputPath)
$presentation.Close()
$pp.Quit()

Write-Output "Created: $outputPath"
