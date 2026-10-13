-- TEST DELTA : un carre rouge doit apparaitre en haut de l'ecran
local gui = Instance.new("ScreenGui")
gui.Name = "DeltaTest"
gui.ResetOnSpawn = false
gui.Parent = game:GetService("Players").LocalPlayer:WaitForChild("PlayerGui")

local box = Instance.new("TextLabel")
box.Size = UDim2.new(0, 260, 0, 60)
box.Position = UDim2.new(0.5, -130, 0, 40)
box.BackgroundColor3 = Color3.fromRGB(200, 30, 30)
box.TextColor3 = Color3.new(1, 1, 1)
box.TextScaled = true
box.Text = "DELTA MARCHE"
box.Parent = gui

task.delay(8, function()
    gui:Destroy()
end)
