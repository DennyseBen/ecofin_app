import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TEST_EMAIL = 'playwright@test.com';
const TEST_PASSWORD = 'password123';

test.beforeAll(async () => {
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const userExists = usersData?.users.find(u => u.email === TEST_EMAIL);

        if (!userExists) {
            await supabaseAdmin.auth.admin.createUser({
                email: TEST_EMAIL,
                password: TEST_PASSWORD,
                email_confirm: true,
                user_metadata: { name: 'Test User' }
            });
        } else {
            await supabaseAdmin.auth.admin.updateUserById(userExists.id, { password: TEST_PASSWORD });
        }
    }
});

test.describe('CRUD Operations', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Login
        await expect(page).toHaveURL(/.*login/);
        await page.locator('input[placeholder="Email"]').fill(TEST_EMAIL);
        await page.locator('input[placeholder="Senha"]').fill(TEST_PASSWORD);
        await page.locator('button:has-text("Entrar")').click();

        // Wait for redirect to dashboard
        await expect(page).not.toHaveURL(/.*login/, { timeout: 15000 });
    });

    test('CRUD - Clientes', async ({ page }) => {
        await page.goto('/clientes');
        await expect(page.locator('h1:has-text("Clientes")')).toBeVisible({ timeout: 15000 });

        const clientName = `Teste Cliente ${Date.now()}`;
        const clientNameUpdated = `${clientName} Atualizado`;

        // CREATE
        await page.locator('button:has-text("Novo Cliente")').click();
        await expect(page.locator('input[placeholder="Nome da empresa"]')).toBeVisible({ timeout: 5000 });
        await page.locator('input[placeholder="Nome da empresa"]').fill(clientName);
        await page.locator('button:has-text("Salvar Cliente")').click();

        // Verify created
        await expect(page.locator(`text=${clientName}`).first()).toBeVisible({ timeout: 10000 });

        // READ & UPDATE
        await page.locator(`text=${clientName}`).first().click();

        // Find the edit button by lucide icon
        await page.locator('.fixed.inset-0 .lucide-edit2').first().click();

        // Fill the updated name
        await page.locator('input').filter({ hasText: clientName }).or(page.locator(`input[value="${clientName}"]`)).first().fill(clientNameUpdated);
        // actually, let's use css class or specific input
        // The razao social edit input doesn't have placeholder
        // It's the first input in the form
        await page.locator('.fixed.inset-0 input.form-input').first().fill(clientNameUpdated);

        await page.locator('button:has-text("Salvar")').click();

        // Verify updated
        await expect(page.locator(`text=${clientNameUpdated}`).first()).toBeVisible({ timeout: 10000 });

        // DELETE
        await page.locator(`text=${clientNameUpdated}`).first().click();

        page.on('dialog', dialog => dialog.accept());
        await page.locator('.fixed.inset-0 .lucide-trash2').first().click();

        // Verify deleted
        await expect(page.locator(`text=${clientNameUpdated}`).first()).not.toBeVisible({ timeout: 10000 });
    });

    test('CRUD - Licencas', async ({ page }) => {
        await page.goto('/licencas');
        await expect(page.locator('h1:has-text("Licenças & Outorgas")')).toBeVisible({ timeout: 15000 });

        const licencaName = `Teste Licenca ${Date.now()}`;

        // CREATE
        await page.locator('button:has-text("Nova Licença")').click();
        // Wait for slide up modal
        await expect(page.locator('h2:has-text("Cadastrar Licença")')).toBeVisible({ timeout: 5000 });

        // Find input by label or placeholder
        await page.locator('input[placeholder="Nome da empresa"]').fill(licencaName);
        await page.locator('button:has-text("Salvar Licença")').click();

        // Verify created
        await expect(page.locator(`text=${licencaName}`).first()).toBeVisible({ timeout: 10000 });

        // CLEANUP
        await page.locator(`text=${licencaName}`).first().click();
        page.on('dialog', dialog => dialog.accept());
        await page.locator('.fixed.inset-0 .lucide-trash2').first().click();
    });

});
