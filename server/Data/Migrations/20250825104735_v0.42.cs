using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Data.Migrations
{
    /// <inheritdoc />
    public partial class v042 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TargetResourceProperties_TargetResourceId",
                table: "TargetResourceProperties");

            migrationBuilder.CreateIndex(
                name: "IX_TargetResources_ResourceType",
                table: "TargetResources",
                column: "ResourceType",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TargetResourceProperties_TargetResourceId_PropertyName",
                table: "TargetResourceProperties",
                columns: new[] { "TargetResourceId", "PropertyName" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TargetResources_ResourceType",
                table: "TargetResources");

            migrationBuilder.DropIndex(
                name: "IX_TargetResourceProperties_TargetResourceId_PropertyName",
                table: "TargetResourceProperties");

            migrationBuilder.CreateIndex(
                name: "IX_TargetResourceProperties_TargetResourceId",
                table: "TargetResourceProperties",
                column: "TargetResourceId");
        }
    }
}
